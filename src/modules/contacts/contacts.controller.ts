import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { ContactsService } from "./contacts.service";
import { CreateContactDto, UpdateContactDto } from "../../dto/contact.dto";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async findAll(
    @Query("search") search?: string,
    @Query("status") status?: string
  ) {
    return this.contactsService.findAll(search, status);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.contactsService.findOne(id);
  }

  @Get(":id/calls")
  async getContactCalls(@Param("id") id: string) {
    return this.contactsService.getContactCalls(id);
  }

  @Post()
  async create(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.create(createContactDto);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateContactDto: UpdateContactDto
  ) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.contactsService.remove(id);
    return { message: "Contact deleted successfully" };
  }
}

