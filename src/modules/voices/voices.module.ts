import { Module } from "@nestjs/common";
import { VoicesController } from "./voices.controller";
import { RetellService } from "../../services/retell.service";

@Module({
  controllers: [VoicesController],
  providers: [RetellService],
  exports: [RetellService],
})
export class VoicesModule {}

