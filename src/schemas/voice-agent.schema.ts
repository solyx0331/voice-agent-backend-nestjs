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
  baseLogic?: {
    greetingMessage: string;
    primaryIntentPrompts: string[];
    leadCaptureQuestions: Array<{
      question: string;
    }>;
    responseLogic?: Array<{
      condition: string;
      action: string;
      response: string;
    }>;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const VoiceAgentSchema = SchemaFactory.createForClass(VoiceAgent);

