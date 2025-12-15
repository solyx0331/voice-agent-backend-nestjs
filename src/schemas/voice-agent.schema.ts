import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type VoiceAgentDocument = VoiceAgent & Document;

@Schema({ timestamps: true })
export class VoiceAgent {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  systemPrompt?: string; // Custom system prompt for the agent

  @Prop({
    type: String,
    enum: ["active", "inactive", "busy"],
    default: "inactive",
  })
  status: "active" | "inactive" | "busy";

  @Prop({ default: 0 })
  calls: number;

  @Prop({ default: "0:00" })
  avgDuration: string;

  @Prop()
  retellAgentId?: string;

  @Prop()
  retellLlmId?: string;

  @Prop()
  phoneNumber?: string; // Twilio phone number in E.164 format (e.g., +61412345678)

  @Prop()
  twilioPhoneNumberSid?: string; // Twilio Phone Number SID

  @Prop()
  webhookUrl?: string; // Webhook URL configured for the phone number

  @Prop({ type: Object })
  voice?: {
    type: "generic" | "custom";
    genericVoice?: string;
    customVoiceId?: string;
    customVoiceUrl?: string;
    temperature?: number; // Voice stability (0-2)
    speed?: number; // Speech speed (0.5-2)
    volume?: number; // Volume level (0-2)
  };

  @Prop()
  greetingScript?: string;

  @Prop({ type: Array })
  faqs?: Array<{
    question: string;
    answer: string;
  }>;

  @Prop({ type: Array })
  intents?: Array<{
    name: string;
    prompt: string;
    response?: string;
  }>;

  @Prop({ type: Object })
  callRules?: {
    businessHours: {
      enabled: boolean;
      timezone: string;
      schedule: Array<{
        day: string;
        start: string;
        end: string;
      }>;
    };
    fallbackToVoicemail: boolean;
    voicemailMessage?: string;
    secondAttemptMessage?: string;
  };

  @Prop({ type: Object })
  leadCapture?: {
    fields: Array<{
      name: string;
      question: string;
      required: boolean;
      type: "text" | "email" | "phone" | "number";
    }>;
  };

  @Prop({ type: Object })
  notifications?: {
    email?: string;
    crm?: {
      type: "webhook" | "salesforce" | "hubspot" | "zapier";
      endpoint?: string;
      apiKey?: string;
    };
  };

  @Prop({ type: Object })
  emailTemplate?: {
    subjectFormat: string;
    bodyTemplate: string;
    fields?: Array<{
      label: string;
      fieldName: string;
      includeInEmail: boolean;
    }>;
  };

  @Prop({ type: Object })
  baseLogic?: {
    greetingMessage: string;
    routingLogics?: Array<{
      id: string;
      name: string;
      condition: string;
      action: string;
      response: string;
      informationGathering: Array<{
        question: string;
      }>;
      leadCaptureFields: Array<{
        name: string;
        question: string;
        required: boolean;
        type: "text" | "email" | "phone" | "number";
      }>;
      completionResponse?: string; // Response after collecting information/lead data
      routingLogics?: Array<any>; // Recursive nested routing logic
    }>;
    // Legacy fields for backward compatibility
    primaryIntentPrompts?: string[];
    leadCaptureQuestions?: Array<{
      question: string;
    }>;
    responseLogic?: Array<{
      condition: string;
      action: string;
      response: string;
    }>;
  };

  // Retell API fields for agent behavior
  @Prop()
  responsiveness?: number; // How responsive the agent is (0-1)

  @Prop()
  interruptionSensitivity?: number; // How easily user can interrupt (0-1)

  // Retell API fields for call management
  @Prop()
  endCallAfterSilenceMs?: number; // End call after silence (min 10000ms)

  @Prop()
  maxCallDurationMs?: number; // Max call duration (60000-7200000ms)

  @Prop()
  beginMessageDelayMs?: number; // Delay before first message (0-5000ms)

  createdAt: Date;
  updatedAt: Date;
}

export const VoiceAgentSchema = SchemaFactory.createForClass(VoiceAgent);

