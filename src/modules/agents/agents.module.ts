import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import {
  VoiceAgent,
  VoiceAgentSchema,
} from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
    ]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}

