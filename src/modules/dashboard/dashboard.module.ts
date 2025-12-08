import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import {
  VoiceAgent,
  VoiceAgentSchema,
} from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";
import { Contact, ContactSchema } from "../../schemas/contact.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

