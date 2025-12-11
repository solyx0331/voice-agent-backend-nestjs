import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { VoiceAgent, VoiceAgentSchema } from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
    ]),
    forwardRef(() => WebSocketModule),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, RetellService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

