import { Injectable, Logger, OnModuleInit, Inject, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";

export interface FieldValue {
  value: any;
  filled: boolean;
  timestamp?: Date;
  source?: "user" | "agent" | "system";
}

export interface ConversationContext {
  callId: string;
  agentId: string;
  fields: Record<string, FieldValue>;
  currentStep?: string; // Current question/step in the flow
  lastQuestion?: string; // Last question asked by agent
  lastUserResponse?: string; // Last response from user
  failedAttempts: number; // Count of consecutive failed attempts
  interruptCount: number; // Count of interruptions
  routingPath?: string[]; // Path taken through routing logic (e.g., ["Evolved Sound", "Quote Request"])
  metadata?: Record<string, any>; // Additional context data
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service to manage conversation context and state
 * Tracks filled fields, unanswered questions, and conversation flow
 */
@Injectable()
export class ContextMemoryService implements OnModuleInit {
  private readonly logger = new Logger(ContextMemoryService.name);
  private contextStore: Map<string, ConversationContext> = new Map(); // callId -> context
  private readonly TTL = 3600000; // 1 hour TTL for context cleanup

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>
  ) {}

  onModuleInit() {
    this.logger.log("ContextMemoryService initialized");
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize context for a new call
   * @param callId Call ID
   * @param agentId Agent ID
   * @param initialRoutingPath Optional initial routing path (e.g., ["QW Direct"])
   */
  async initializeContext(
    callId: string,
    agentId: string,
    initialRoutingPath?: string[]
  ): Promise<ConversationContext> {
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Determine which field schemas to use based on routing path
    const fieldSchemas = agent.fieldSchemas || [];
    
    // Initialize fields from schema
    const fields: Record<string, FieldValue> = {};
    for (const schema of fieldSchemas) {
      fields[schema.fieldName] = {
        value: schema.defaultValue || null,
        filled: false,
      };
    }

    const context: ConversationContext = {
      callId,
      agentId,
      fields,
      failedAttempts: 0,
      interruptCount: 0,
      routingPath: initialRoutingPath || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.contextStore.set(callId, context);
    this.logger.log(`Initialized context for call ${callId}`);
    return context;
  }

  /**
   * Update context with new user utterance
   * Extracts field values from the utterance and updates context
   * @param callId Call ID
   * @param utterance User's spoken text
   * @returns Updated context
   */
  async updateContext(
    callId: string,
    utterance: string
  ): Promise<ConversationContext> {
    const context = this.contextStore.get(callId);
    if (!context) {
      this.logger.warn(`No context found for call ${callId}`);
      throw new Error(`Context not initialized for call ${callId}`);
    }

    // Update last user response
    context.lastUserResponse = utterance;
    context.updatedAt = new Date();

    // Load agent to get field schemas
    const agent = await this.agentModel.findById(context.agentId);
    if (!agent) {
      throw new Error(`Agent ${context.agentId} not found`);
    }

    const fieldSchemas = agent.fieldSchemas || [];

    // Extract field values from utterance
    const extractedFields = this.extractFields(utterance, fieldSchemas);

    // Update context fields
    for (const [fieldName, value] of Object.entries(extractedFields)) {
      if (!context.fields[fieldName]) {
        context.fields[fieldName] = {
          value: null,
          filled: false,
        };
      }
      
      if (value !== null && value !== undefined) {
        context.fields[fieldName] = {
          value,
          filled: true,
          timestamp: new Date(),
          source: "user",
        };
        this.logger.debug(`Updated field ${fieldName} = ${value} for call ${callId}`);
      }
    }

    // Reset failed attempts if we got a valid response
    if (Object.keys(extractedFields).length > 0 || utterance.trim().length > 0) {
      context.failedAttempts = 0;
    }

    this.contextStore.set(callId, context);
    return context;
  }

  /**
   * Extract field values from utterance using regex and NLP hints
   */
  private extractFields(
    utterance: string,
    fieldSchemas: any[]
  ): Record<string, any> {
    const extracted: Record<string, any> = {};
    const lowerUtterance = utterance.toLowerCase();

    for (const schema of fieldSchemas) {
      // Skip if already extracted
      if (extracted[schema.fieldName]) {
        continue;
      }

      let value: any = null;

      // Try different extraction methods based on data type
      switch (schema.dataType) {
        case "email":
          const emailMatch = utterance.match(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
          );
          if (emailMatch) {
            value = emailMatch[0];
          }
          break;

        case "phone":
          // Australian phone format: 04XX XXX XXX or +61 4XX XXX XXX
          const phoneMatch = utterance.match(
            /(?:\+?61|0)?[2-478](?:[ -]?[0-9]){8}/
          );
          if (phoneMatch) {
            value = phoneMatch[0].replace(/\s+/g, " ");
          }
          break;

        case "number":
          // Extract numeric values
          const numberMatch = utterance.match(/\d+/);
          if (numberMatch) {
            value = parseInt(numberMatch[0], 10);
          }
          break;

        case "choice":
          // Match against choice options
          if (schema.choiceOptions) {
            for (const option of schema.choiceOptions) {
              if (lowerUtterance.includes(option.toLowerCase())) {
                value = option;
                break;
              }
            }
          }
          break;

        case "text":
        default:
          // Use NLP hints if available
          if (schema.nlpExtractionHints && schema.nlpExtractionHints.length > 0) {
            for (const hint of schema.nlpExtractionHints) {
              const hintLower = hint.toLowerCase();
              if (lowerUtterance.includes(hintLower)) {
                // Try to extract value after the hint
                const hintIndex = lowerUtterance.indexOf(hintLower);
                const afterHint = utterance.substring(hintIndex + hint.length).trim();
                const valueMatch = afterHint.match(/^[^\s,\.!?]+/);
                if (valueMatch) {
                  value = valueMatch[0].trim();
                  break;
                }
              }
            }
          }
          
          // If no hints, and it's the current question being asked, use the utterance as value
          // (This is a simple heuristic - in production, use better NLP)
          if (!value && utterance.trim().length > 0) {
            // Don't auto-extract text without hints
            value = null;
          }
          break;
      }

      if (value !== null) {
        extracted[schema.fieldName] = value;
      }
    }

    return extracted;
  }

  /**
   * Get context for a call
   */
  getContext(callId: string): ConversationContext | null {
    return this.contextStore.get(callId) || null;
  }

  /**
   * Check if a field is filled
   */
  isFilled(callId: string, fieldName: string): boolean {
    const context = this.contextStore.get(callId);
    if (!context) {
      return false;
    }
    return context.fields[fieldName]?.filled || false;
  }

  /**
   * Get all filled fields
   */
  getFilledFields(callId: string): string[] {
    const context = this.contextStore.get(callId);
    if (!context) {
      return [];
    }
    return Object.keys(context.fields).filter(
      (fieldName) => context.fields[fieldName]?.filled
    );
  }

  /**
   * Get all missing required fields
   */
  async getMissingRequiredFields(callId: string): Promise<string[]> {
    const context = this.contextStore.get(callId);
    if (!context) {
      return [];
    }

    const agent = await this.agentModel.findById(context.agentId);
    if (!agent) {
      return [];
    }

    const fieldSchemas = agent.fieldSchemas || [];
    const requiredFields = fieldSchemas
      .filter((schema) => schema.required)
      .map((schema) => schema.fieldName);

    return requiredFields.filter(
      (fieldName) => !context.fields[fieldName]?.filled
    );
  }

  /**
   * Get next unfilled field based on display order
   */
  async getNextUnfilledField(callId: string): Promise<any | null> {
    const context = this.contextStore.get(callId);
    if (!context) {
      return null;
    }

    const agent = await this.agentModel.findById(context.agentId);
    if (!agent) {
      return null;
    }

    const fieldSchemas = agent.fieldSchemas || [];
    const sortedFields = [...fieldSchemas].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );

    for (const schema of sortedFields) {
      if (!context.fields[schema.fieldName]?.filled) {
        return schema;
      }
    }

    return null;
  }

  /**
   * Update current step/question
   */
  updateCurrentStep(callId: string, step: string, question?: string): void {
    const context = this.contextStore.get(callId);
    if (!context) {
      return;
    }

    context.currentStep = step;
    context.lastQuestion = question;
    context.updatedAt = new Date();
    this.contextStore.set(callId, context);
  }

  /**
   * Increment failed attempts counter
   */
  incrementFailedAttempts(callId: string): void {
    const context = this.contextStore.get(callId);
    if (!context) {
      return;
    }

    context.failedAttempts += 1;
    context.updatedAt = new Date();
    this.contextStore.set(callId, context);
  }

  /**
   * Increment interrupt counter
   */
  incrementInterruptCount(callId: string): void {
    const context = this.contextStore.get(callId);
    if (!context) {
      return;
    }

    context.interruptCount += 1;
    context.updatedAt = new Date();
    this.contextStore.set(callId, context);
  }

  /**
   * Update routing path
   */
  updateRoutingPath(callId: string, routingStep: string): void {
    const context = this.contextStore.get(callId);
    if (!context) {
      return;
    }

    if (!context.routingPath) {
      context.routingPath = [];
    }
    context.routingPath.push(routingStep);
    context.updatedAt = new Date();
    this.contextStore.set(callId, context);
  }

  /**
   * Check if user answered the last question
   */
  didUserAnswerLastQuestion(callId: string): boolean {
    const context = this.contextStore.get(callId);
    if (!context || !context.lastQuestion) {
      return false;
    }

    // Simple heuristic: if last user response has content, assume they answered
    return (
      context.lastUserResponse !== undefined &&
      context.lastUserResponse.trim().length > 0
    );
  }

  /**
   * Clear context (when call ends)
   */
  clearContext(callId: string): void {
    this.contextStore.delete(callId);
    this.logger.log(`Cleared context for call ${callId}`);
  }

  /**
   * Start cleanup interval to remove old contexts
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const toDelete: string[] = [];

      for (const [callId, context] of this.contextStore.entries()) {
        const age = now.getTime() - context.updatedAt.getTime();
        if (age > this.TTL) {
          toDelete.push(callId);
        }
      }

      toDelete.forEach((callId) => {
        this.contextStore.delete(callId);
        this.logger.debug(`Cleaned up old context for call ${callId}`);
      });
    }, 60000); // Run every minute
  }

  /**
   * Get all fields with their values
   */
  getAllFields(callId: string): Record<string, any> {
    const context = this.contextStore.get(callId);
    if (!context) {
      return {};
    }

    const result: Record<string, any> = {};
    for (const [fieldName, fieldValue] of Object.entries(context.fields)) {
      if (fieldValue.filled) {
        result[fieldName] = fieldValue.value;
      }
    }
    return result;
  }
}

