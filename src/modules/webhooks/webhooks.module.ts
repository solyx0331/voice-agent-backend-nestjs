import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { VoiceAgent, VoiceAgentSchema } from "../../schemas/voice-agent.schema";
import { RetellService } from "../../services/retell.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
    ]),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, RetellService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

