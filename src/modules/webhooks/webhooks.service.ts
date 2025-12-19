import { Injectable, Logger, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";
import { ElevenLabsService } from "../../services/elevenlabs.service";
import { StorageService } from "../../services/storage.service";
import { EmailService } from "../../services/email.service";
import { LiveCallsGateway } from "../websocket/websocket.gateway";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
    private retellService: RetellService,
    private elevenLabsService: ElevenLabsService,
    private storageService: StorageService,
    private emailService: EmailService,
    @Inject(forwardRef(() => LiveCallsGateway))
    private liveCallsGateway: LiveCallsGateway
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

    const updatedCall = await this.callModel.findByIdAndUpdate(call._id, { $set: updates }, { new: true });

    // Emit WebSocket event for call started
    if (updatedCall) {
      this.liveCallsGateway.emitCallStarted({
        callId: updatedCall._id.toString(),
        retellCallId: updatedCall.retellCallId,
        agentId: updatedCall.agentId?.toString(),
        phone: updatedCall.phone,
        contact: updatedCall.contact,
        startTime: updatedCall.startTime,
        type: updatedCall.type,
      });
    }
  }

  /**
   * Handle call ended event
   * According to Retell API: https://docs.retellai.com/api-references/get-call
   */
  private async handleCallEnded(call: CallDocument, callData: any): Promise<void> {
    this.logger.log(`Call ended: ${call._id}`);

    // Some Retell webhook variants don't include full timing / recording / transcript data.
    // If critical timing fields are missing, try to fetch the complete call object from Retell.
    if (
      !callData.start_timestamp &&
      !callData.end_timestamp &&
      !callData.duration_ms
    ) {
      try {
        const fullCallData = await this.retellService.getCallDetails(
          call.retellCallId || callData.call_id
        );

        if (fullCallData) {
          this.logger.log(
            `Enriched call_ended payload with full call data from Retell for call ${call._id}`
          );
          // Merge, giving precedence to webhook fields but filling gaps from fullCallData
          callData = {
            ...fullCallData,
            ...callData,
          };
        } else {
          this.logger.warn(
            `Could not enrich call_ended payload for call ${call._id} – using webhook data only`
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Error enriching call_ended data from Retell for call ${call._id}: ${error.message}`,
          error.stack
        );
      }
    }

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
    // If no disconnection_reason is provided, default to success if call completed normally
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
    } else if (callData.call_status === "ended" && updates.status === "completed") {
      // If call ended normally without a disconnection reason, consider it successful
      updates.outcome = "success";
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
    let extractedData: Record<string, any> = {};
    if (callData.call_analysis) {
      // Map Retell sentiment to our format (lowercase)
      let sentiment: "positive" | "neutral" | "negative" | "unknown" | undefined;
      if (callData.call_analysis.user_sentiment) {
        const sentimentLower = callData.call_analysis.user_sentiment.toLowerCase();
        if (sentimentLower === "positive" || sentimentLower === "negative" || sentimentLower === "neutral" || sentimentLower === "unknown") {
          sentiment = sentimentLower;
        }
      }

      extractedData = callData.call_analysis.custom_analysis_data || {};
      updates.callAnalysis = {
        sentiment: sentiment,
        summary: callData.call_analysis.call_summary,
        extractedData: extractedData,
      };
    }

    // Extract data from transcript if not already extracted (post-call extraction)
    // This happens after call ends, so agent doesn't prompt for this information
    if (updates.transcript && Object.keys(extractedData).length === 0) {
      extractedData = this.extractDataFromTranscript(updates.transcript);
      if (updates.callAnalysis) {
        updates.callAnalysis.extractedData = extractedData;
      } else {
        updates.callAnalysis = {
          extractedData: extractedData,
        };
      }
    }

    // Extract data from transcript if not already extracted (post-call extraction)
    if (updates.transcript && Object.keys(extractedData).length === 0) {
      extractedData = this.extractDataFromTranscript(updates.transcript);
      if (updates.callAnalysis) {
        updates.callAnalysis.extractedData = extractedData;
      } else {
        updates.callAnalysis = {
          extractedData: extractedData,
        };
      }
    }

    // Update call cost if available
    if (callData.call_cost) {
      updates.callCost = {
        total: callData.call_cost.combined_cost / 100 || 0, // Convert from cents
        currency: "USD", // Default, can be extracted if available
      };
    }

    const updatedCall = await this.callModel.findByIdAndUpdate(call._id, { $set: updates }, { new: true });

    // Emit WebSocket event for call ended
    if (updatedCall) {
      this.liveCallsGateway.emitCallEnded({
        callId: updatedCall._id.toString(),
        retellCallId: updatedCall.retellCallId,
        status: updates.status,
        duration: updates.duration,
        ...updates,
      });
    }

    // Update agent call count
    if (call.agentId) {
      const agent = await this.agentModel.findById(call.agentId);
      if (agent) {
        agent.calls = (agent.calls || 0) + 1;
        await agent.save();

        // Send email notification if configured
        if (agent.notifications?.email && updatedCall) {
          await this.sendCallSummaryEmail(agent, updatedCall);
        }
      }
    }
  }

  /**
   * Send email notification with call summary to the caller
   * @param agent Agent configuration
   * @param call Call document with analysis
   */
  private async sendCallSummaryEmail(agent: VoiceAgentDocument, call: CallDocument): Promise<void> {
    try {
      // Extract caller's email from call analysis (collected during lead capture)
      const extractedData = call.callAnalysis?.extractedData || {};
      const callerEmail = extractedData.email;
      
      if (!callerEmail) {
        this.logger.log(`No caller email found in call ${call._id}. Skipping email.`);
        return;
      }

      // Extract all data from call analysis - use exact information gained during call
      const callSummary = call.callAnalysis?.summary || "No summary available";

      // Build email data from all extracted fields with exact information gained during call
      const emailData: Record<string, any> = {
        ...extractedData, // Include all extracted data first (exact values from call)
        // Map common field names (PascalCase for template) - use exact values, empty string if not provided
        CompanyName: extractedData.companyName || extractedData.company || "",
        CallerName: extractedData.callerName || extractedData.name || call.contact || "",
        PhoneNumber: call.phone || extractedData.phoneNumber || extractedData.phone || "",
        Email: callerEmail,
        ServiceType: extractedData.serviceType || extractedData.service || "",
        Budget: extractedData.budget || "",
        BusinessType: extractedData.businessType || extractedData.business || "",
        CompanySize: extractedData.companySize || "",
        Timeline: extractedData.timeline || extractedData.timeframe || "",
        AgentGeneratedSummary: callSummary,
        // Also include camelCase versions for compatibility
        companyName: extractedData.companyName || extractedData.company || "",
        callerName: extractedData.callerName || extractedData.name || call.contact || "",
        phoneNumber: call.phone || extractedData.phoneNumber || extractedData.phone || "",
        email: callerEmail,
        serviceType: extractedData.serviceType || extractedData.service || "",
        budget: extractedData.budget || "",
        businessType: extractedData.businessType || extractedData.business || "",
        companySize: extractedData.companySize || "",
        timeline: extractedData.timeline || extractedData.timeframe || "",
        callSummary: callSummary,
      };

      // Generate email subject from template or use default
      const subjectTemplate = agent.emailTemplate?.subjectFormat || "New Inquiry - {{CompanyName}} - {{CallerName}}";
      const subject = this.replaceTemplateVariables(subjectTemplate, emailData);

      // Generate email body using template with exact information replacement
      const bodyTemplate = agent.emailTemplate?.bodyTemplate || `Company: {{CompanyName}}

Name: {{CallerName}}

Phone: {{PhoneNumber}}

Email: {{Email}}

Service Interested In: {{ServiceType}}

Budget (if provided): {{Budget}}

Business Type (if provided): {{BusinessType}}

Company Size (QW Direct): {{CompanySize}}

Timeline: {{Timeline}}

Call Summary:

{{AgentGeneratedSummary}}`;
      
      const emailBody = this.emailService.generateCallSummaryEmailFromTemplate(bodyTemplate, emailData);

      // Send email to client (caller) with exact information collected during call
      await this.emailService.sendEmail(callerEmail, subject, emailBody);
      this.logger.log(`Call summary email sent to client ${callerEmail} for call ${call._id}`);
    } catch (error: any) {
      this.logger.error(`Failed to send call summary email: ${error.message}`, error.stack);
      // Don't throw - email failure shouldn't break the call flow
    }
  }

  /**
   * Generate email template fields dynamically from agent configuration
   * Based on lead capture fields and information gathering questions
   */
  private generateEmailTemplateFields(agent: VoiceAgentDocument): Array<{
    label: string;
    fieldName: string;
    includeInEmail: boolean;
  }> {
    const fields: Array<{ label: string; fieldName: string; includeInEmail: boolean }> = [];
    const seenFieldNames = new Set<string>();

    // Recursive function to process routing logics (including nested ones)
    const processRoutingLogics = (routings: any[]) => {
      routings.forEach((routing) => {
        // Add lead capture fields from this routing logic (these have explicit field names)
        routing.leadCaptureFields?.forEach((field: any) => {
          if (!seenFieldNames.has(field.name)) {
            fields.push({
              label: field.question || field.name,
              fieldName: field.name,
              includeInEmail: true,
            });
            seenFieldNames.add(field.name);
          }
        });

        // Add information gathering questions from this routing logic
        // These don't have explicit field names, so we'll use the question text as a key
        routing.informationGathering?.forEach((item: any, index: number) => {
          // Try to infer field name from question (e.g., "What is your budget?" -> "budget")
          const questionKey = item.question?.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30) || `info_${index}`;
          if (!seenFieldNames.has(questionKey)) {
            fields.push({
              label: item.question || `Information ${index + 1}`,
              fieldName: questionKey,
              includeInEmail: true,
            });
            seenFieldNames.add(questionKey);
          }
        });

        // Recursively process nested routing logics
        if (routing.routingLogics && routing.routingLogics.length > 0) {
          processRoutingLogics(routing.routingLogics);
        }
      });
    };

    // Process all routing logics (including nested ones)
    if (agent.baseLogic?.routingLogics) {
      processRoutingLogics(agent.baseLogic.routingLogics);
    }

    // Add universal lead capture fields if they exist (from leadCapture.fields)
    if (agent.leadCapture?.fields) {
      agent.leadCapture.fields.forEach((field: any) => {
        if (!seenFieldNames.has(field.name)) {
          fields.push({
            label: field.question || field.name,
            fieldName: field.name,
            includeInEmail: true,
          });
          seenFieldNames.add(field.name);
        }
      });
    }

    // Always include call summary at the end
    fields.push({
      label: "Call Summary",
      fieldName: "callSummary",
      includeInEmail: true,
    });

    return fields;
  }

  /**
   * Replace template variables in a string with actual values
   */
  private replaceTemplateVariables(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
      // Try exact match first
      if (data[fieldName] !== undefined) {
        return data[fieldName] || "";
      }
      // Try camelCase
      const camelCase = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
      if (data[camelCase] !== undefined) {
        return data[camelCase] || "";
      }
      // Try common field mappings
      const fieldMap: Record<string, string> = {
        CompanyName: data.companyName || data.company || "",
        CallerName: data.callerName || data.name || "",
        PhoneNumber: data.phoneNumber || data.phone || "",
        Email: data.email || "",
      };
      return fieldMap[fieldName] || "";
    });
  }

  /**
   * Extract data from transcript after call ends
   * Analyzes the transcript to extract key information without prompting the agent
   */
  private extractDataFromTranscript(transcript: Array<{ speaker: string; text: string; timestamp: string }>): Record<string, any> {
    const extracted: Record<string, any> = {};
    const fullText = transcript.map(t => t.text).join(" ").toLowerCase();

    // Extract company name
    const companyPatterns = [
      /(?:company|business|organization|firm|corporation)[\s:]+(?:is|called|named|name is|)?[\s:]*([A-Z][a-zA-Z\s]+(?:Sound|Direct|Inc|LLC|Corp|Ltd)?)/i,
      /(?:calling|contacting|reaching|speaking with|about|for)[\s:]+([A-Z][a-zA-Z\s]+(?:Sound|Direct|Inc|LLC|Corp|Ltd)?)/i,
      /(evolved sound|qw direct)/i,
    ];
    for (const pattern of companyPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.companyName = match[1]?.trim();
        break;
      }
    }

    // Extract caller name
    const namePatterns = [
      /(?:my name is|i'm|i am|this is|caller name|name)[\s:]+([A-Z][a-zA-Z\s]+)/i,
      /(?:name)[\s:]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.callerName = match[1]?.trim();
        break;
      }
    }

    // Extract email
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const emailMatch = fullText.match(emailPattern);
    if (emailMatch) {
      extracted.email = emailMatch[1];
    }

    // Extract phone number
    const phonePatterns = [
      /(?:phone|number|contact|call me at|reach me at)[\s:]+([+]?[\d\s\-\(\)]{10,})/i,
      /([+]?[\d\s\-\(\)]{10,})/,
    ];
    for (const pattern of phonePatterns) {
      const match = fullText.match(pattern);
      if (match && match[1].replace(/\D/g, "").length >= 10) {
        extracted.phoneNumber = match[1].trim();
        break;
      }
    }

    // Extract service type
    const servicePatterns = [
      /(?:service|looking for|interested in|need|want|enquiring about|enquiry)[\s:]+([^.!?]+)/i,
      /(?:voice over|audio production|direct marketing|digital campaign|marketing|production)/i,
    ];
    for (const pattern of servicePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.serviceType = match[1]?.trim();
        break;
      }
    }

    // Extract budget
    const budgetPatterns = [
      /(?:budget|price|cost|spending|willing to pay|around|approximately|about)[\s:]+([$]?[\d,]+(?:\s*(?:thousand|k|million|m|dollars|usd))?)/i,
      /[$]([\d,]+)/,
    ];
    for (const pattern of budgetPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.budget = match[1]?.trim();
        break;
      }
    }

    // Extract business type
    const businessPatterns = [
      /(?:individual|person|personal|business|company|corporate|b2b|b2c)/i,
    ];
    for (const pattern of businessPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.businessType = match[0]?.trim();
        break;
      }
    }

    // Extract company size
    const sizePatterns = [
      /(?:company size|size|employees|staff|people|team)[\s:]+([\d,]+(?:\s*(?:employees|people|staff|members))?)/i,
      /(?:small|medium|large|enterprise|startup)/i,
    ];
    for (const pattern of sizePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.companySize = match[1] || match[0];
        break;
      }
    }

    // Extract timeline
    const timelinePatterns = [
      /(?:timeline|timeframe|when|by|deadline|asap|soon|urgent|within)[\s:]+([^.!?]+)/i,
      /(?:next week|next month|this week|this month|as soon as possible|asap|urgent)/i,
    ];
    for (const pattern of timelinePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        extracted.timeline = match[1] || match[0];
        break;
      }
    }

    return extracted;
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

    const updatedCall = await this.callModel.findByIdAndUpdate(call._id, {
      $set: { transcript: mergedTranscript },
    }, { new: true });

    // Emit WebSocket event for transcript update
    if (updatedCall) {
      this.liveCallsGateway.emitCallTranscript(
        updatedCall._id.toString(),
        mergedTranscript
      );
    }
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

  /**
   * Handle Retell function_call event - when LLM generates a response that needs to be spoken
   * This method generates TTS using ElevenLabs and returns a play_audio action to Retell
   * @param body Retell webhook payload
   * @returns Response with play_audio action or null if not applicable
   */
  async handleRetellFunctionCall(body: any): Promise<any | null> {
    try {
      this.logger.log("Handling Retell function_call event for TTS");

      // Extract call information
      const callData = body.call || body;
      const retellCallId = callData.call_id;
      const agentId = callData.agent_id;

      if (!retellCallId || !agentId) {
        this.logger.warn("Missing call_id or agent_id in function_call webhook");
        return null;
      }

      // Find the agent by Retell agent ID
      const agent = await this.agentModel.findOne({ retellAgentId: agentId });
      if (!agent) {
        this.logger.warn(`Agent not found for Retell agent_id: ${agentId}`);
        return null;
      }

      // Check if agent has a custom ElevenLabs voice
      if (!agent.voice || agent.voice.type !== "custom" || !agent.voice.customVoiceId) {
        this.logger.log("Agent does not have a custom ElevenLabs voice, skipping TTS");
        return null; // Let Retell handle TTS with default voice
      }

      // Extract the text to speak from the function_call
      // Retell function_call structure may vary, check for common fields
      const textToSpeak = 
        body.response_text || 
        body.text || 
        body.function_call?.response_text ||
        body.function_call?.text ||
        callData.response_text ||
        callData.text;

      if (!textToSpeak) {
        this.logger.warn("No text found in function_call webhook to convert to speech");
        return null;
      }

      this.logger.log(`Generating TTS for text: ${textToSpeak.substring(0, 100)}...`);

      // Generate TTS using ElevenLabs
      const audioBuffer = await this.elevenLabsService.textToSpeech(
        textToSpeak,
        agent.voice.customVoiceId,
        {
          stability: agent.voice.temperature !== undefined ? agent.voice.temperature / 2 : 0.5, // Map temperature (0-2) to stability (0-1)
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        }
      );

      // Upload audio to public URL
      const audioUrl = await this.storageService.uploadAudio(
        audioBuffer,
        `tts_${retellCallId}_${Date.now()}.mp3`
      );

      this.logger.log(`TTS audio generated and uploaded: ${audioUrl}`);

      // Return play_audio action to Retell
      // Retell expects a response with action type "play_audio"
      return {
        action: "play_audio",
        audio_url: audioUrl,
      };
    } catch (error: any) {
      this.logger.error(
        `Error handling Retell function_call for TTS: ${error.message}`,
        error.stack
      );
      // Return null to let Retell handle TTS with default voice
      return null;
    }
  }
}

