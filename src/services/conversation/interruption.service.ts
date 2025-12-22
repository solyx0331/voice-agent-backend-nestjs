import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

export interface InterruptionEvent {
  callId: string;
  timestamp: Date;
  userUtterance?: string; // Captured text from the interruption
  agentWasSpeaking: boolean; // Whether agent was mid-speech
  interruptType: "barge-in" | "pause" | "clear";
}

/**
 * Service to handle interruptions/barge-in during voice calls
 * Hooks into Twilio/Retell events to pause/clear agent speech when user interrupts
 */
@Injectable()
export class InterruptionService implements OnModuleInit {
  private readonly logger = new Logger(InterruptionService.name);
  private activeInterrupts: Map<string, InterruptionEvent> = new Map(); // callId -> interrupt event
  private interruptListeners: Map<string, (event: InterruptionEvent) => void> = new Map();

  constructor() {}

  onModuleInit() {
    this.logger.log("InterruptionService initialized");
  }

  /**
   * Handle user started speaking event (from Twilio Media Stream or Retell)
   * @param callId Call ID
   * @param metadata Additional metadata from the event
   */
  async handleUserStartedSpeaking(
    callId: string,
    metadata?: {
      agentWasSpeaking?: boolean;
      audioLevel?: number;
      timestamp?: Date;
    }
  ): Promise<InterruptionEvent> {
    this.logger.debug(`User started speaking during call ${callId}`);

    const interruptEvent: InterruptionEvent = {
      callId,
      timestamp: metadata?.timestamp || new Date(),
      agentWasSpeaking: metadata?.agentWasSpeaking ?? true, // Assume agent was speaking if unknown
      interruptType: "barge-in",
    };

    // Store the interrupt event
    this.activeInterrupts.set(callId, interruptEvent);

    // Notify listeners
    this.notifyListeners("user.interrupted", interruptEvent);

    // Signal to pause/clear agent speech
    await this.pauseAgentSpeech(callId);

    return interruptEvent;
  }

  /**
   * Pause or clear ongoing agent TTS output
   * This would typically send a command to Twilio/Retell to stop playback
   * @param callId Call ID
   */
  async pauseAgentSpeech(callId: string): Promise<void> {
    this.logger.debug(`Pausing agent speech for call ${callId}`);

    // In production, this would:
    // 1. For Twilio: Send a WebSocket message to clear the media stream
    //    Example: { event: "clear", streamSid: "..." }
    // 2. For Retell: Use Retell's API to pause/interrupt agent speech

    // Notify listeners that speech was paused
    this.notifyListeners("agent.speech.paused", {
      callId,
      timestamp: new Date(),
    } as any);
  }

  /**
   * Capture the full user utterance after interruption
   * Called after the user finishes speaking
   * @param callId Call ID
   * @param userUtterance Full transcript of what user said
   */
  async captureInterruptUtterance(
    callId: string,
    userUtterance: string
  ): Promise<InterruptionEvent | null> {
    const interruptEvent = this.activeInterrupts.get(callId);
    if (!interruptEvent) {
      this.logger.warn(`No active interrupt found for call ${callId}`);
      return null;
    }

    interruptEvent.userUtterance = userUtterance;

    // Update the stored event
    this.activeInterrupts.set(callId, interruptEvent);

    // Notify listeners that interrupt is complete
    this.notifyListeners("user.interrupt.complete", interruptEvent);

    return interruptEvent;
  }

  /**
   * Handle WebSocket event from Twilio Media Stream
   * Example event structure:
   * {
   *   event: "media",
   *   streamSid: "...",
   *   media: { ... }
   * }
   */
  async handleTwilioMediaStreamEvent(
    callId: string,
    event: any
  ): Promise<void> {
    // Detect user started speaking from audio level or speech detection
    if (event.event === "start" && event.start?.customParameters?.direction === "inbound") {
      // User is speaking
      await this.handleUserStartedSpeaking(callId, {
        agentWasSpeaking: true, // Assume agent was speaking
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle Retell webhook event
   * Retell sends events like:
   * - "agent_started_speaking"
   * - "agent_stopped_speaking"
   * - "user_started_speaking"
   * - "user_stopped_speaking"
   */
  async handleRetellEvent(callId: string, event: any): Promise<void> {
    if (event.event === "user_started_speaking" || event.event === "function_call.user_interrupted") {
      await this.handleUserStartedSpeaking(callId, {
        agentWasSpeaking: true, // Retell can provide this in the event
        timestamp: new Date(event.timestamp || Date.now()),
      });
    }
  }

  /**
   * Clear an interrupt event (call ended or interrupt handled)
   * @param callId Call ID
   */
  clearInterrupt(callId: string): void {
    this.activeInterrupts.delete(callId);
    this.logger.debug(`Cleared interrupt for call ${callId}`);
  }

  /**
   * Get active interrupt for a call
   * @param callId Call ID
   */
  getActiveInterrupt(callId: string): InterruptionEvent | null {
    return this.activeInterrupts.get(callId) || null;
  }

  /**
   * Check if there's an active interrupt
   * @param callId Call ID
   */
  hasActiveInterrupt(callId: string): boolean {
    return this.activeInterrupts.has(callId);
  }

  /**
   * Register a listener for interrupt events
   */
  on(event: string, callback: (event: InterruptionEvent) => void): void {
    this.interruptListeners.set(event, callback);
  }

  /**
   * Notify listeners of an event
   */
  private notifyListeners(event: string, data: InterruptionEvent): void {
    const listener = this.interruptListeners.get(event);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        this.logger.error(`Error in interrupt listener for ${event}:`, error);
      }
    }
  }
}

