import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import {
  VoiceAgent,
  VoiceAgentSchema,
} from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";
import { TwilioService } from "../../services/twilio.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
    ]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, RetellService, TwilioService],
  exports: [AgentsService],
})
export class AgentsModule {}

