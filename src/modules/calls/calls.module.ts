import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CallsController } from "./calls.controller";
import { CallsService } from "./calls.service";
import { Call, CallSchema } from "../../schemas/call.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
  ],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}

