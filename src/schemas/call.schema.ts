import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CallDocument = Call & Document;

@Schema({ timestamps: true })
export class Call {
  _id: Types.ObjectId;

  @Prop({ required: true })
  contact: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  agent: string;

  @Prop({ type: Types.ObjectId, ref: "VoiceAgent" })
  agentId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ["inbound", "outbound", "missed"],
    required: true,
  })
  type: "inbound" | "outbound" | "missed";

  @Prop({ default: "0:00" })
  duration: string;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ required: true })
  time: string;

  @Prop({
    type: String,
    enum: ["completed", "missed", "voicemail"],
    default: "completed",
  })
  status: "completed" | "missed" | "voicemail";

  @Prop({ default: false })
  recording: boolean;

  @Prop({
    type: String,
    enum: ["success", "caller_hung_up", "speech_not_recognized", "other"],
  })
  outcome?: "success" | "caller_hung_up" | "speech_not_recognized" | "other";

  @Prop({ type: Object })
  latency?: {
    avg: number;
    peak: number;
  };

  @Prop({ type: Array })
  transcript?: Array<{
    speaker: "user" | "ai";
    text: string;
    timestamp: string;
  }>;

  @Prop({ type: Types.ObjectId, ref: "Contact" })
  contactId?: Types.ObjectId;

  // Retell-specific fields
  @Prop()
  retellCallId?: string; // Retell call ID for tracking

  @Prop()
  twilioCallSid?: string; // Twilio Call SID for tracking

  @Prop()
  recordingUrl?: string; // URL to call recording (if available)

  @Prop({ type: Object })
  callAnalysis?: {
    sentiment?: "positive" | "neutral" | "negative" | "unknown";
    summary?: string;
    extractedData?: Record<string, any>;
  };

  @Prop({ type: Object })
  callCost?: {
    total?: number;
    currency?: string;
  };

  @Prop()
  disconnectionReason?: string; // Reason for call end

  @Prop({ type: Date })
  startTime?: Date; // Actual call start time

  @Prop({ type: Date })
  endTime?: Date; // Actual call end time

  createdAt: Date;
  updatedAt: Date;
}

export const CallSchema = SchemaFactory.createForClass(Call);

