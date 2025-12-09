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
   * @param agentId Agent ID from URL parameter
   * @param body Twilio webhook payload
   * @returns Retell call details for TwiML generation
   */
  async handleTwilioWebhook(agentId: string, body: any): Promise<{
    callId: string;
    agentId: string;
  }> {
    // Find the agent
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    // Check if agent has Retell agent ID
    if (!agent.retellAgentId) {
      this.logger.warn(`Agent ${agentId} does not have a Retell agent ID`);
      throw new NotFoundException(`Agent ${agentId} does not have a Retell agent ID configured`);
    }

    // Extract call information from Twilio webhook
    const fromNumber = body.From || body.Caller;
    const toNumber = body.To || body.Called;
    const callSid = body.CallSid;
    const callStatus = body.CallStatus;

    this.logger.log(
      `Processing Twilio webhook for agent ${agentId}: Call from ${fromNumber} to ${toNumber}, Status: ${callStatus}`
    );

    // Only register with Retell when call is initiated (ringing or in-progress)
    if (callStatus === "ringing" || callStatus === "in-progress" || !callStatus) {
      try {
        // Register the call with Retell to start a session
        const retellCall = await this.retellService.registerPhoneCall(
          agent.retellAgentId,
          fromNumber,
          toNumber
        );

        this.logger.log(
          `Registered call with Retell. Call ID: ${retellCall.call_id}, Agent ID: ${agent.retellAgentId}`
        );

        // TODO: Create call record in database with retellCall.call_id
        // TODO: Store mapping between Twilio CallSid and Retell call_id

        return {
          callId: retellCall.call_id,
          agentId: agent.retellAgentId,
        };
      } catch (error: any) {
        this.logger.error(
          `Failed to register call with Retell: ${error.message}`,
          error.stack
        );
        throw error;
      }
    } else {
      // Handle other call statuses (completed, busy, failed, etc.)
      this.logger.log(`Call status ${callStatus} - not registering with Retell`);
      
      // TODO: Update call record in database with final status
      
      // Return empty for non-initiating statuses
      return {
        callId: "",
        agentId: agent.retellAgentId,
      };
    }
  }

  /**
   * Generate TwiML response for Twilio to connect to Retell
   * This tells Twilio how to handle the incoming call and connect to Retell's SIP endpoint
   * @param retellCallId Retell call ID from registerPhoneCall
   * @param agentId Agent ID (optional, for logging)
   * @returns TwiML XML string
   */
  generateTwiMLResponse(retellCallId: string, agentId?: string): string {
    if (!retellCallId) {
      // If no Retell call ID, return error TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, we're unable to connect your call at this time. Please try again later.</Say>
  <Hangup/>
</Response>`;
    }

    // Retell's SIP endpoint format for Twilio integration
    // Format: sip:{call_id}@sip.retellai.com
    const retellSipEndpoint = `sip:${retellCallId}@sip.retellai.com`;

    this.logger.log(
      `Generating TwiML to connect to Retell SIP endpoint: ${retellSipEndpoint}`
    );

    // Return TwiML that connects Twilio call to Retell's SIP endpoint
    // This uses Twilio's <Dial> verb to connect to Retell via SIP
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>
      ${retellSipEndpoint}
    </Sip>
  </Dial>
</Response>`;
  }
}

