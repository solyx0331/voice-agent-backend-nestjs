import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ContactDocument = Contact & Document;

@Schema({ timestamps: true })
export class Contact {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  company: string;

  @Prop({ default: 0 })
  totalCalls: number;

  @Prop()
  lastContact?: Date;

  @Prop({
    type: String,
    enum: ["active", "inactive", "lead"],
    default: "active",
  })
  status: "active" | "inactive" | "lead";

  createdAt: Date;
  updatedAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

