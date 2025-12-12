import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { VoicesController } from "./voices.controller";
import { VoiceUploadController } from "./voice-upload.controller";
import { VoicesService } from "./voices.service";
import { RetellService } from "../../services/retell.service";
import { ElevenLabsService } from "../../services/elevenlabs.service";
import { CustomVoice, CustomVoiceSchema } from "../../schemas/custom-voice.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomVoice.name, schema: CustomVoiceSchema },
    ]),
  ],
  controllers: [VoicesController, VoiceUploadController],
  providers: [VoicesService, RetellService, ElevenLabsService],
  exports: [RetellService, VoicesService, ElevenLabsService],
})
export class VoicesModule {}

