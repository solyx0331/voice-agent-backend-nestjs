import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CustomVoiceDocument = CustomVoice & Document;

@Schema({ timestamps: true })
export class CustomVoice {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  voiceId: string; // Retell voice ID after upload

  @Prop({ required: true })
  url: string; // URL to the voice file

  @Prop({ required: true, enum: ["uploaded", "recorded"] })
  type: "uploaded" | "recorded";

  @Prop()
  fileName?: string; // Original filename

  @Prop()
  fileSize?: number; // File size in bytes

  @Prop()
  mimeType?: string; // MIME type of the file

  createdAt: Date;
  updatedAt: Date;
}

export const CustomVoiceSchema = SchemaFactory.createForClass(CustomVoice);




