import { Module } from "@nestjs/common";
import { LiveCallsGateway } from "./websocket.gateway";

@Module({
  providers: [LiveCallsGateway],
  exports: [LiveCallsGateway],
})
export class WebSocketModule {}





