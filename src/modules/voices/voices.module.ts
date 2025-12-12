import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { VoicesController } from "./voices.controller";
import { VoicesService } from "./voices.service";
import { RetellService } from "../../services/retell.service";
import { CustomVoice, CustomVoiceSchema } from "../../schemas/custom-voice.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomVoice.name, schema: CustomVoiceSchema },
    ]),
  ],
  controllers: [VoicesController],
  providers: [VoicesService, RetellService],
  exports: [RetellService, VoicesService],
})
export class VoicesModule {}

