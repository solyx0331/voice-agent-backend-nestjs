import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";

export interface IntentMatchResult {
  intentName: string;
  confidence: number;
  matchingType: "semantic" | "regex" | "keyword";
  routingAction: string;
}

@Injectable()
export class IntentDetectorService {
  private readonly logger = new Logger(IntentDetectorService.name);
  private embeddingCache: Map<string, number[][]> = new Map(); // Cache for embedding vectors

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>
  ) {}

  /**
   * Detect intent from user utterance
   * @param agentId Agent ID to load intent definitions from
   * @param utterance User's spoken text
   * @returns Intent match result or null if no match
   */
  async detectIntent(
    agentId: string,
    utterance: string
  ): Promise<IntentMatchResult | null> {
    if (!utterance || utterance.trim().length === 0) {
      return null;
    }

    const agent = await this.agentModel.findById(agentId);
    if (!agent || !agent.intentDefinitions || agent.intentDefinitions.length === 0) {
      this.logger.debug(`No intent definitions found for agent ${agentId}`);
      return null;
    }

    const normalizedUtterance = utterance.toLowerCase().trim();

    // Try each enabled intent
    for (const intent of agent.intentDefinitions) {
      if (!intent.enabled) {
        continue;
      }

      if (intent.matchingType === "regex") {
        const match = this.matchRegex(intent, normalizedUtterance, utterance);
        if (match) {
          return match;
        }
      } else if (intent.matchingType === "semantic") {
        const match = await this.matchSemantic(
          agentId,
          intent,
          normalizedUtterance,
          utterance
        );
        if (match) {
          return match;
        }
      }
    }

    return null;
  }

  /**
   * Match using regex pattern
   */
  private matchRegex(
    intent: any,
    normalizedUtterance: string,
    originalUtterance: string
  ): IntentMatchResult | null {
    if (!intent.regexPattern) {
      return null;
    }

    try {
      // Support both /pattern/flags and pattern formats
      let pattern: string;
      let flags = "i"; // Default to case-insensitive

      if (intent.regexPattern.startsWith("/")) {
        const match = intent.regexPattern.match(/^\/(.+)\/([gimuy]*)$/);
        if (match) {
          pattern = match[1];
          flags = match[2] || "i";
        } else {
          pattern = intent.regexPattern.slice(1); // Remove leading /
        }
      } else {
        pattern = intent.regexPattern;
      }

      const regex = new RegExp(pattern, flags);
      if (regex.test(originalUtterance) || regex.test(normalizedUtterance)) {
        return {
          intentName: intent.name,
          confidence: 1.0, // Regex matches are exact
          matchingType: "regex",
          routingAction: intent.routingAction,
        };
      }
    } catch (error) {
      this.logger.warn(`Invalid regex pattern for intent ${intent.name}: ${intent.regexPattern}`);
    }

    return null;
  }

  /**
   * Match using semantic similarity (fallback to keyword matching if embeddings not available)
   */
  private async matchSemantic(
    agentId: string,
    intent: any,
    normalizedUtterance: string,
    originalUtterance: string
  ): Promise<IntentMatchResult | null> {
    if (!intent.sampleUtterances || intent.sampleUtterances.length === 0) {
      return null;
    }

    const threshold = intent.confidenceThreshold || 0.7;

    // Try keyword-based similarity first (simple and fast)
    const keywordMatch = this.matchKeywords(intent, normalizedUtterance);
    if (keywordMatch && keywordMatch.confidence >= threshold) {
      return keywordMatch;
    }

    // TODO: In production, use actual embeddings (e.g., OpenAI embeddings or sentence-transformers)
    // For now, use enhanced keyword matching with word overlap
    const enhancedMatch = this.matchEnhancedKeywords(intent, normalizedUtterance);
    if (enhancedMatch && enhancedMatch.confidence >= threshold) {
      return enhancedMatch;
    }

    return null;
  }

  /**
   * Simple keyword matching
   */
  private matchKeywords(
    intent: any,
    normalizedUtterance: string
  ): IntentMatchResult | null {
    let maxSimilarity = 0;

    for (const sample of intent.sampleUtterances) {
      const sampleLower = sample.toLowerCase();
      
      // Exact match
      if (normalizedUtterance === sampleLower) {
        return {
          intentName: intent.name,
          confidence: 1.0,
          matchingType: "keyword",
          routingAction: intent.routingAction,
        };
      }

      // Contains match
      if (normalizedUtterance.includes(sampleLower) || sampleLower.includes(normalizedUtterance)) {
        const similarity = Math.min(sampleLower.length, normalizedUtterance.length) / 
                          Math.max(sampleLower.length, normalizedUtterance.length);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    if (maxSimilarity > 0.5) {
      return {
        intentName: intent.name,
        confidence: maxSimilarity,
        matchingType: "keyword",
        routingAction: intent.routingAction,
      };
    }

    return null;
  }

  /**
   * Enhanced keyword matching using word overlap and Jaccard similarity
   */
  private matchEnhancedKeywords(
    intent: any,
    normalizedUtterance: string
  ): IntentMatchResult | null {
    const utteranceWords = new Set(
      normalizedUtterance.split(/\s+/).filter(w => w.length > 2) // Filter short words
    );

    let maxSimilarity = 0;
    let bestMatch: string | null = null;

    for (const sample of intent.sampleUtterances) {
      const sampleLower = sample.toLowerCase();
      const sampleWords = new Set(
        sampleLower.split(/\s+/).filter(w => w.length > 2)
      );

      // Calculate Jaccard similarity (intersection / union)
      const intersection = new Set([...utteranceWords].filter(x => sampleWords.has(x)));
      const union = new Set([...utteranceWords, ...sampleWords]);
      
      const jaccardSimilarity = intersection.size / union.size;

      // Boost similarity if key phrases match
      let boostedSimilarity = jaccardSimilarity;
      for (const word of intersection) {
        if (word.length > 4) { // Longer words are more significant
          boostedSimilarity += 0.1;
        }
      }
      boostedSimilarity = Math.min(1.0, boostedSimilarity);

      if (boostedSimilarity > maxSimilarity) {
        maxSimilarity = boostedSimilarity;
        bestMatch = sample;
      }
    }

    if (maxSimilarity > 0.3) {
      return {
        intentName: intent.name,
        confidence: maxSimilarity,
        matchingType: "semantic",
        routingAction: intent.routingAction,
      };
    }

    return null;
  }

  /**
   * Refresh intent definitions cache (useful for hot-reloading)
   */
  async refreshCache(agentId: string): Promise<void> {
    // Clear any cached embeddings for this agent
    const keysToDelete: string[] = [];
    for (const key of this.embeddingCache.keys()) {
      if (key.startsWith(`${agentId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.embeddingCache.delete(key));
    
    this.logger.log(`Refreshed intent cache for agent ${agentId}`);
  }

  /**
   * Get all enabled intents for an agent
   */
  async getEnabledIntents(agentId: string): Promise<any[]> {
    const agent = await this.agentModel.findById(agentId);
    if (!agent || !agent.intentDefinitions) {
      return [];
    }
    return agent.intentDefinitions.filter((intent: any) => intent.enabled);
  }
}

