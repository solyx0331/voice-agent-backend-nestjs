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
    return contacts.map((contact) => ({
      ...contact.toObject(),
      id: contact._id.toString(),
    }));
  }

  async findOne(id: string) {
    const contact = await this.contactModel.findById(id);

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    return {
      ...contact.toObject(),
      id: contact._id.toString(),
    };
  }

  async create(createContactDto: CreateContactDto) {
    const contact = new this.contactModel({
      ...createContactDto,
      status: createContactDto.status || "active",
      totalCalls: 0,
    });

    const saved = await contact.save();
    return {
      ...saved.toObject(),
      id: saved._id.toString(),
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

    return {
      ...contact.toObject(),
      id: contact._id.toString(),
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

    return calls.map((call) => ({
      ...call.toObject(),
      id: call._id.toString(),
    }));
  }
}
