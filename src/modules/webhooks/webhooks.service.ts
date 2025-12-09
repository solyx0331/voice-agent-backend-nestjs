import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { RetellService } from "../../services/retell.service";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    private retellService: RetellService
  ) {}

  /**
   * Handle incoming Twilio webhook
   * @param agentId Agent ID
   * @param body Twilio webhook payload
   */
  async handleTwilioWebhook(agentId: string, body: any): Promise<void> {
    // Find the agent
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Check if agent has Retell agent ID
    if (!agent.retellAgentId) {
      this.logger.warn(`Agent ${agentId} does not have a Retell agent ID`);
      return;
    }

    // Log the webhook event
    this.logger.log(
      `Processing Twilio webhook for agent ${agentId}: ${body.CallStatus || "unknown status"}`
    );

    // Handle different Twilio call events
    // You can extend this to handle call status updates, recordings, etc.
    // For now, we'll just log the event
    if (body.CallStatus) {
      this.logger.log(`Call status: ${body.CallStatus}`);
    }

    // TODO: Create call record in database
    // TODO: Forward call to Retell AI agent
    // TODO: Handle call events (ringing, answered, completed, etc.)
  }

  /**
   * Generate TwiML response for Twilio
   * This tells Twilio how to handle the incoming call
   * @param agentId Agent ID
   * @returns TwiML XML string
   */
  generateTwiMLResponse(agentId: string): string {
    // For now, return a simple response
    // In production, you would:
    // 1. Connect the call to Retell AI
    // 2. Use Retell's TwiML or connect via their API
    // 3. Return appropriate TwiML instructions

    // Example: Connect to Retell AI agent
    // This is a placeholder - you'll need to integrate with Retell's call handling
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to your AI assistant.</Say>
  <!-- Retell AI integration would go here -->
</Response>`;
  }
}

