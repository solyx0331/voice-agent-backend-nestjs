import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
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

        // Create initial call record in database
        const callRecord = new this.callModel({
          contact: "Unknown", // Will be updated from Retell webhook if available
          phone: fromNumber || "Unknown",
          agent: agent.name,
          agentId: new Types.ObjectId(agentId),
          type: retellCall.direction === "outbound" ? "outbound" : "inbound",
          duration: "0:00",
          date: new Date(),
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          status: "completed", // Will be updated when call ends
          recording: false, // Will be updated if recording is available
          retellCallId: retellCall.call_id,
          twilioCallSid: callSid,
          startTime: new Date(),
        });

        await callRecord.save();
        this.logger.log(`Created call record in database: ${callRecord._id}`);

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

  /**
   * Handle incoming Retell webhook events
   * Retell sends webhooks for various call events:
   * - call_started: When a call begins
   * - call_ended: When a call ends
   * - call_transcript: Real-time transcript updates
   * - call_analyzed: Post-call analysis (sentiment, summary, etc.)
   * @param body Retell webhook payload
   */
  async handleRetellWebhook(body: any): Promise<void> {
    this.logger.log(`Received Retell webhook: ${body.event || "unknown event"}`);
    this.logger.debug(`Retell webhook payload: ${JSON.stringify(body, null, 2)}`);

    const eventType = body.event;
    // Retell webhook structure: { event: "...", call: { ... } }
    // The call object contains all call details (same as get-call API response)
    const callData = body.call || body;

    // Extract Retell call ID from call object
    const retellCallId = callData.call_id;
    if (!retellCallId) {
      this.logger.warn("Retell webhook missing call_id in call object");
      return;
    }

    // Find call record by Retell call ID
    let call = await this.callModel.findOne({ retellCallId });

    if (!call) {
      this.logger.warn(`Call record not found for Retell call ID: ${retellCallId}`);
      // Try to find by Twilio CallSid if available (might be in metadata)
      if (callData.metadata?.twilio_call_sid || callData.metadata?.twilioCallSid) {
        call = await this.callModel.findOne({
          twilioCallSid: callData.metadata.twilio_call_sid || callData.metadata.twilioCallSid,
        });
      }
    }

    if (!call) {
      this.logger.error(
        `Cannot update call record - not found for Retell call ID: ${retellCallId}`
      );
      return;
    }

    // Handle different event types
    switch (eventType) {
      case "call_started":
        await this.handleCallStarted(call, callData);
        break;

      case "call_ended":
      case "call_terminated":
        await this.handleCallEnded(call, callData);
        break;

      case "call_transcript":
        await this.handleCallTranscript(call, callData);
        break;

      case "call_analyzed":
        await this.handleCallAnalyzed(call, callData);
        break;

      default:
        this.logger.log(`Unhandled Retell webhook event: ${eventType}`);
    }
  }

  /**
   * Handle call started event
   * According to Retell API: https://docs.retellai.com/api-references/get-call
   */
  private async handleCallStarted(call: CallDocument, callData: any): Promise<void> {
    this.logger.log(`Call started: ${call._id}`);

    const updates: any = {
      status: "completed", // Call is in progress
    };

    // Update start time from timestamp (milliseconds)
    if (callData.start_timestamp) {
      updates.startTime = new Date(callData.start_timestamp);
    }

    // Update caller information if available
    if (callData.from_number) {
      updates.phone = callData.from_number;
    }

    // Update contact name if available from dynamic variables
    if (callData.retell_llm_dynamic_variables?.customer_name) {
      updates.contact = callData.retell_llm_dynamic_variables.customer_name;
    }

    // Update call type/direction if available
    if (callData.direction) {
      updates.type = callData.direction === "inbound" ? "inbound" : "outbound";
    }

    await this.callModel.findByIdAndUpdate(call._id, { $set: updates });
  }

  /**
   * Handle call ended event
   * According to Retell API: https://docs.retellai.com/api-references/get-call
   */
  private async handleCallEnded(call: CallDocument, callData: any): Promise<void> {
    this.logger.log(`Call ended: ${call._id}`);

    // Calculate duration from timestamps (milliseconds)
    let duration = "0:00";
    if (callData.start_timestamp && callData.end_timestamp) {
      const durationMs = callData.end_timestamp - callData.start_timestamp;
      const durationSeconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    } else if (callData.duration_ms) {
      // Fallback to duration_ms if timestamps not available
      const durationSeconds = Math.floor(callData.duration_ms / 1000);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const updates: any = {
      duration: duration,
      status: callData.call_status === "ended" ? "completed" : "missed",
      disconnectionReason: callData.disconnection_reason,
    };

    // Update end time from timestamp (milliseconds)
    if (callData.end_timestamp) {
      updates.endTime = new Date(callData.end_timestamp);
    }

    // Update start time if not already set
    if (callData.start_timestamp && !call.startTime) {
      updates.startTime = new Date(callData.start_timestamp);
    }

    // Update recording URL if available
    if (callData.recording_url) {
      updates.recording = true;
      updates.recordingUrl = callData.recording_url;
    }

    // Update outcome based on disconnection reason
    if (callData.disconnection_reason) {
      const reason = callData.disconnection_reason.toLowerCase();
      if (reason === "user_hangup") {
        updates.outcome = "caller_hung_up";
      } else if (reason.includes("speech_not_recognized") || reason.includes("error_asr")) {
        updates.outcome = "speech_not_recognized";
      } else if (reason === "agent_hangup" || reason === "call_transfer") {
        updates.outcome = "success";
      } else {
        updates.outcome = "success"; // Default to success for other reasons
      }
    }

    // Update latency if available (use e2e latency as average)
    if (callData.latency?.e2e) {
      updates.latency = {
        avg: callData.latency.e2e.p50 || callData.latency.e2e.average || 0,
        peak: callData.latency.e2e.max || callData.latency.e2e.p99 || 0,
      };
    }

    // Store full transcript if available (from transcript_object)
    if (callData.transcript_object && Array.isArray(callData.transcript_object)) {
      const transcript = callData.transcript_object.map((item: any) => {
        const speaker = item.role === "agent" || item.role === "assistant" ? "ai" : "user";
        // Calculate timestamp from word timing or use start_timestamp as base
        let timestamp: string;
        if (item.words && item.words.length > 0 && item.words[0].start) {
          // Use first word's start time (in seconds) relative to call start
          const startTime = callData.start_timestamp || call.startTime?.getTime() || Date.now();
          timestamp = new Date(startTime + (item.words[0].start * 1000)).toISOString();
        } else {
          timestamp = new Date().toISOString();
        }

        return {
          speaker: speaker,
          text: item.content || item.text || "",
          timestamp: timestamp,
        };
      });
      updates.transcript = transcript;
    }

    // Update call analysis if available (from call_analyzed event or included in call_ended)
    if (callData.call_analysis) {
      // Map Retell sentiment to our format (lowercase)
      let sentiment: "positive" | "neutral" | "negative" | "unknown" | undefined;
      if (callData.call_analysis.user_sentiment) {
        const sentimentLower = callData.call_analysis.user_sentiment.toLowerCase();
        if (sentimentLower === "positive" || sentimentLower === "negative" || sentimentLower === "neutral" || sentimentLower === "unknown") {
          sentiment = sentimentLower;
        }
      }

      updates.callAnalysis = {
        sentiment: sentiment,
        summary: callData.call_analysis.call_summary,
        extractedData: callData.call_analysis.custom_analysis_data || {},
      };
    }

    // Update call cost if available
    if (callData.call_cost) {
      updates.callCost = {
        total: callData.call_cost.combined_cost / 100 || 0, // Convert from cents
        currency: "USD", // Default, can be extracted if available
      };
    }

    await this.callModel.findByIdAndUpdate(call._id, { $set: updates });

    // Update agent call count
    if (call.agentId) {
      const agent = await this.agentModel.findById(call.agentId);
      if (agent) {
        agent.calls = (agent.calls || 0) + 1;
        await agent.save();
      }
    }
  }

  /**
   * Handle call transcript updates
   * According to Retell API: https://docs.retellai.com/api-references/get-call
   * Retell sends transcript_object which is an array of transcript items
   */
  private async handleCallTranscript(call: CallDocument, callData: any): Promise<void> {
    this.logger.log(`Transcript update for call: ${call._id}`);

    // Retell provides transcript_object as an array of transcript items
    // Each item has: role ("agent" or "user"), content, words (with timestamps)
    const transcriptObject = callData.transcript_object || [];

    if (transcriptObject.length === 0) {
      this.logger.warn("No transcript_object in call_transcript event");
      return;
    }

    // Convert transcript_object to our format
    const transcript = transcriptObject.map((item: any) => {
      const speaker = item.role === "agent" || item.role === "assistant" ? "ai" : "user";
      // Calculate timestamp from word timing or use start_timestamp as base
      let timestamp: string;
      if (item.words && item.words.length > 0 && item.words[0].start !== undefined) {
        // Use first word's start time (in seconds) relative to call start
        const startTime = call.startTime?.getTime() || call.createdAt?.getTime() || Date.now();
        timestamp = new Date(startTime + (item.words[0].start * 1000)).toISOString();
      } else {
        // Fallback: use current time or call start time
        timestamp = call.startTime?.toISOString() || new Date().toISOString();
      }

      return {
        speaker: speaker,
        text: item.content || item.text || "",
        timestamp: timestamp,
      };
    });

    // Merge with existing transcript if any (for incremental updates)
    const existingTranscript = call.transcript || [];
    const transcriptMap = new Map<string, any>();
    
    // Add existing transcripts
    existingTranscript.forEach((item: any) => {
      const key = `${item.speaker}_${item.timestamp}`;
      transcriptMap.set(key, item);
    });

    // Add/update with new transcripts
    transcript.forEach((item: any) => {
      const key = `${item.speaker}_${item.timestamp}`;
      transcriptMap.set(key, item);
    });

    // Convert map back to array and sort by timestamp
    const mergedTranscript = Array.from(transcriptMap.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    await this.callModel.findByIdAndUpdate(call._id, {
      $set: { transcript: mergedTranscript },
    });
  }

  /**
   * Handle call analyzed event (sentiment, summary, extracted data)
   * According to Retell API: https://docs.retellai.com/api-references/get-call
   * The call_analysis object contains: call_summary, user_sentiment, call_successful, custom_analysis_data
   */
  private async handleCallAnalyzed(call: CallDocument, callData: any): Promise<void> {
    this.logger.log(`Call analyzed: ${call._id}`);

    const analysis = callData.call_analysis || {};
    
    // Map Retell sentiment to our format (lowercase)
    let sentiment: "positive" | "neutral" | "negative" | "unknown" | undefined;
    if (analysis.user_sentiment) {
      const sentimentLower = analysis.user_sentiment.toLowerCase();
      if (sentimentLower === "positive" || sentimentLower === "negative" || sentimentLower === "neutral" || sentimentLower === "unknown") {
        sentiment = sentimentLower;
      }
    }

    const updates: any = {
      callAnalysis: {
        sentiment: sentiment,
        summary: analysis.call_summary,
        extractedData: analysis.custom_analysis_data || {},
      },
    };

    // Update call cost if available (cost is in cents, convert to dollars)
    if (callData.call_cost) {
      updates.callCost = {
        total: callData.call_cost.combined_cost / 100 || 0, // Convert from cents to dollars
        currency: "USD", // Default, can be extracted if available in API
      };
    }

    await this.callModel.findByIdAndUpdate(call._id, { $set: updates });
  }
}

