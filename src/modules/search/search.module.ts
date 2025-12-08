import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import {
  VoiceAgent,
  VoiceAgentSchema,
} from "../../schemas/voice-agent.schema";
import { Call, CallSchema } from "../../schemas/call.schema";
import { Contact, ContactSchema } from "../../schemas/contact.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceAgent.name, schema: VoiceAgentSchema },
      { name: Call.name, schema: CallSchema },
      { name: Contact.name, schema: ContactSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

