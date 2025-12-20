import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { Call, CallSchema } from "../../schemas/call.schema";
import { RetellService } from "../../services/retell.service";

@Module({
  imports: [
    ConfigModule, // Import ConfigModule for RetellService dependency
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
  ],
  controllers: [CallsController],
  providers: [CallsService, RetellService],
  exports: [CallsService],
})
export class CallsModule {}

