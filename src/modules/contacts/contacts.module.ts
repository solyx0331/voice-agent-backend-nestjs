import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { Contact, ContactSchema } from "../../schemas/contact.schema";
import { Call, CallSchema } from "../../schemas/call.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contact.name, schema: ContactSchema },
      { name: Call.name, schema: CallSchema },
    ]),
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}

