import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IntentDetectorService } from "../../services/conversation/intent-detector.service";
import { InterruptionService } from "../../services/conversation/interruption.service";
import { ContextMemoryService } from "../../services/conversation/context-memory.service";
import { VoiceAgent, VoiceAgentSchema } from "../../schemas/voice-agent.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
    ]),
  ],
  providers: [
    IntentDetectorService,
    InterruptionService,
    ContextMemoryService,
  ],
  exports: [
    IntentDetectorService,
    InterruptionService,
    ContextMemoryService,
  ],
})
export class ConversationModule {}

