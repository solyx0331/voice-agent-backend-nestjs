import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contact, ContactDocument } from "../../schemas/contact.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { CreateContactDto, UpdateContactDto } from "../../dto/contact.dto";

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private contactModel: Model<ContactDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>
  ) {}

  private formatDate(date: Date | string | undefined): string {
    if (!date) return "";
    if (typeof date === "string") return date;
    return date.toISOString().split("T")[0];
  }

  async findAll(search?: string, status?: string) {
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const contacts = await this.contactModel.find(query).sort({ createdAt: -1 });
    return contacts.map((contact) => {
      const obj = contact.toObject();
      return {
        ...obj,
        id: contact._id.toString(),
        lastContact: this.formatDate(contact.lastContact),
      };
    });
  }

  async findOne(id: string) {
    const contact = await this.contactModel.findById(id);

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const obj = contact.toObject();
    return {
      ...obj,
      id: contact._id.toString(),
      lastContact: this.formatDate(contact.lastContact),
    };
  }

  async create(createContactDto: CreateContactDto) {
    const contact = new this.contactModel({
      ...createContactDto,
      status: createContactDto.status || "active",
      totalCalls: 0,
    });

    const saved = await contact.save();
    const obj = saved.toObject();
    return {
      ...obj,
      id: saved._id.toString(),
      lastContact: this.formatDate(saved.lastContact),
    };
  }

  async update(id: string, updateContactDto: UpdateContactDto) {
    const contact = await this.contactModel.findByIdAndUpdate(
      id,
      { $set: updateContactDto },
      { new: true }
    );

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const obj = contact.toObject();
    return {
      ...obj,
      id: contact._id.toString(),
      lastContact: this.formatDate(contact.lastContact),
    };
  }

  async remove(id: string) {
    const contact = await this.contactModel.findByIdAndDelete(id);

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
  }

  async getContactCalls(contactId: string) {
    const contact = await this.contactModel.findById(contactId);

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    const calls = await this.callModel
      .find({
        $or: [
          { contact: contact.name },
          { phone: contact.phone },
          { contactId: contactId },
        ],
      })
      .sort({ createdAt: -1 });

    return calls.map((call) => {
      const obj = call.toObject();
      return {
        ...obj,
        id: call._id.toString(),
        date: this.formatDate(call.date),
      };
    });
  }
}
