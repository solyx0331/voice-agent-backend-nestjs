import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { VoiceAgent, VoiceAgentSchema } from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";
import { ElevenLabsService } from "../../services/elevenlabs.service";
import { StorageService } from "../../services/storage.service";
import { EmailService } from "../../services/email.service";
import { WebSocketModule } from "../websocket/websocket.module";
import { ConversationModule } from "../conversation/conversation.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
    ]),
    forwardRef(() => WebSocketModule),
    ConversationModule, // Import to access IntentRoutingDispatcherService
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, RetellService, ElevenLabsService, StorageService, EmailService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

