import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { IntentDetectorService, IntentMatchResult } from "./intent-detector.service";

export interface RoutingHandlerResult {
  action: string;
  success: boolean;
  message?: string;
  shouldEndCall?: boolean;
  nextPrompt?: string;
  metadata?: Record<string, any>;
}

export interface RoutingHandler {
  (context: RoutingContext): Promise<RoutingHandlerResult> | RoutingHandlerResult;
}

export interface RoutingContext {
  agentId: string;
  intentMatch: IntentMatchResult;
  collectedFields?: Record<string, any>;
  callId?: string;
  transcript?: string;
}

/**
 * Intent-driven routing dispatcher service
 * Maps detected intents to routing action handlers dynamically
 */
@Injectable()
export class IntentRoutingDispatcherService {
  private readonly logger = new Logger(IntentRoutingDispatcherService.name);
  
  // Registry of routing handlers
  private routingHandlers: Map<string, RoutingHandler> = new Map();
  
  // Default routing action descriptions (for tooltips/help text)
  private readonly routingActionDescriptions: Record<string, string> = {
    "callback": "Collect contact information and terminate the call. Agent will ask for name and phone number, then end the call.",
    "quote": "Collect quotation details and continue with pricing flow. Agent will gather product/service details and budget information.",
    "continue-flow": "Continue to the next question in the conversation flow. This is the default action when no specific intent matches.",
    "opt-out": "Handle opt-out request (e.g., stop recording, unsubscribe). Agent will acknowledge and stop the requested action.",
    "transfer": "Transfer the call to a human representative. Agent will collect basic info and connect to a live agent.",
    "voicemail": "Route to voicemail. Agent will prompt caller to leave a message.",
    "end-call": "End the call immediately. Agent will provide a closing message and terminate.",
    "escalate": "Escalate to higher priority handling. Agent will collect urgent details and flag for immediate follow-up.",
  };

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    private intentDetector: IntentDetectorService
  ) {
    // Register default routing handlers
    this.registerDefaultHandlers();
  }

  /**
   * Register a routing handler for a specific action
   */
  registerHandler(action: string, handler: RoutingHandler): void {
    this.routingHandlers.set(action.toLowerCase(), handler);
    this.logger.log(`Registered routing handler for action: ${action}`);
  }

  /**
   * Register default routing handlers
   */
  private registerDefaultHandlers(): void {
    // Callback handler
    this.registerHandler("callback", async (context) => {
      this.logger.log(`Callback handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "callback",
        success: true,
        message: "I'll make sure someone calls you back. Let me get your contact information.",
        shouldEndCall: false, // Will end after collecting contact info
        nextPrompt: "May I have your name and phone number?",
        metadata: {
          requiresFields: ["name", "phone"],
          endAfterCollection: true,
        },
      };
    });

    // Quote handler
    this.registerHandler("quote", async (context) => {
      this.logger.log(`Quote handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "quote",
        success: true,
        message: "I'd be happy to help you with a quote. Let me gather some details.",
        shouldEndCall: false,
        nextPrompt: "What product or service are you interested in?",
        metadata: {
          requiresFields: ["product", "quantity", "budget"],
        },
      };
    });

    // Continue flow handler (default)
    this.registerHandler("continue-flow", async (context) => {
      this.logger.debug(`Continue flow handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "continue-flow",
        success: true,
        message: undefined, // No specific message, just continue
        shouldEndCall: false,
        metadata: {
          continueToNext: true,
        },
      };
    });

    // Opt-out handler
    this.registerHandler("opt-out", async (context) => {
      this.logger.log(`Opt-out handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "opt-out",
        success: true,
        message: "I understand. I'll stop the recording and make a note of your preference.",
        shouldEndCall: false,
        metadata: {
          stopRecording: true,
        },
      };
    });

    // Transfer handler
    this.registerHandler("transfer", async (context) => {
      this.logger.log(`Transfer handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "transfer",
        success: true,
        message: "I'll transfer you to one of our representatives. Please hold for a moment.",
        shouldEndCall: false,
        metadata: {
          transferToHuman: true,
        },
      };
    });

    // Voicemail handler
    this.registerHandler("voicemail", async (context) => {
      this.logger.log(`Voicemail handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "voicemail",
        success: true,
        message: "I'll connect you to voicemail. Please leave your message after the tone.",
        shouldEndCall: false,
        metadata: {
          routeToVoicemail: true,
        },
      };
    });

    // End call handler
    this.registerHandler("end-call", async (context) => {
      this.logger.log(`End call handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "end-call",
        success: true,
        message: "Thank you for calling. Have a great day!",
        shouldEndCall: true,
      };
    });

    // Escalate handler
    this.registerHandler("escalate", async (context) => {
      this.logger.log(`Escalate handler triggered for intent: ${context.intentMatch.intentName}`);
      return {
        action: "escalate",
        success: true,
        message: "I'll escalate this to our priority team. Can you tell me what's urgent?",
        shouldEndCall: false,
        metadata: {
          priority: "high",
          requiresUrgentFollowUp: true,
        },
      };
    });
  }

  /**
   * Dispatch routing based on detected intent
   * @param agentId Agent ID
   * @param utterance User utterance
   * @param context Additional context (collected fields, call ID, etc.)
   * @returns Routing handler result
   */
  async dispatch(
    agentId: string,
    utterance: string,
    context?: Partial<RoutingContext>
  ): Promise<RoutingHandlerResult> {
    try {
      // Detect intent from utterance
      const intentMatch = await this.intentDetector.detectIntent(agentId, utterance);

      if (!intentMatch) {
        this.logger.debug(`No intent matched for utterance: "${utterance}". Falling back to continue-flow.`);
        return this.handleFallback(agentId, utterance, context);
      }

      this.logger.log(
        `Intent detected: ${intentMatch.intentName} (confidence: ${intentMatch.confidence}) -> Routing action: ${intentMatch.routingAction}`
      );

      // Get routing action from intent
      const routingAction = intentMatch.routingAction || "continue-flow";

      // Check if handler exists
      const handler = this.routingHandlers.get(routingAction.toLowerCase());

      if (!handler) {
        this.logger.warn(
          `No handler found for routing action: ${routingAction}. Falling back to continue-flow.`
        );
        return this.handleFallback(agentId, utterance, context, intentMatch);
      }

      // Build routing context
      const routingContext: RoutingContext = {
        agentId,
        intentMatch,
        collectedFields: context?.collectedFields || {},
        callId: context?.callId,
        transcript: context?.transcript || utterance,
      };

      // Execute handler
      const result = await handler(routingContext);

      this.logger.log(
        `Routing handler executed: ${routingAction} -> Success: ${result.success}`
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `Error in routing dispatcher: ${error.message}`,
        error.stack
      );

      // Fallback on error
      return this.handleFallback(agentId, utterance, context);
    }
  }

  /**
   * Handle fallback when no intent matches or handler fails
   */
  private async handleFallback(
    agentId: string,
    utterance: string,
    context?: Partial<RoutingContext>,
    intentMatch?: IntentMatchResult
  ): Promise<RoutingHandlerResult> {
    const fallbackHandler = this.routingHandlers.get("continue-flow");
    
    if (fallbackHandler) {
      const routingContext: RoutingContext = {
        agentId,
        intentMatch: intentMatch || {
          intentName: "unknown",
          confidence: 0,
          matchingType: "keyword",
          routingAction: "continue-flow",
        },
        collectedFields: context?.collectedFields || {},
        callId: context?.callId,
        transcript: context?.transcript || utterance,
      };

      return await fallbackHandler(routingContext);
    }

    // Ultimate fallback
    return {
      action: "continue-flow",
      success: true,
      message: undefined,
      shouldEndCall: false,
      metadata: {
        fallback: true,
      },
    };
  }

  /**
   * Get routing action description (for tooltips/help text)
   */
  getRoutingActionDescription(action: string): string {
    return (
      this.routingActionDescriptions[action.toLowerCase()] ||
      `Custom routing action: ${action}. Behavior depends on agent configuration.`
    );
  }

  /**
   * Get all available routing actions with descriptions
   */
  getAllRoutingActions(): Record<string, string> {
    return { ...this.routingActionDescriptions };
  }

  /**
   * Check if a routing action is registered
   */
  hasHandler(action: string): boolean {
    return this.routingHandlers.has(action.toLowerCase());
  }

  /**
   * Get custom routing actions from agent configuration
   */
  async getCustomRoutingActions(agentId: string): Promise<string[]> {
    try {
      const agent = await this.agentModel.findById(agentId);
      return agent?.customRoutingActions || [];
    } catch (error: any) {
      this.logger.error(
        `Error fetching custom routing actions for agent ${agentId}: ${error.message}`
      );
      return [];
    }
  }
}

