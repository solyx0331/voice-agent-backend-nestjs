import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { Contact, ContactDocument } from "../../schemas/contact.schema";

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
    @InjectModel(Contact.name)
    private contactModel: Model<ContactDocument>
  ) {}

  async searchGlobal(query: string) {
    const queryRegex = { $regex: query, $options: "i" };

    const [agents, calls, contacts] = await Promise.all([
      this.agentModel.find({
        $or: [{ name: queryRegex }, { description: queryRegex }],
      }),
      this.callModel.find({
        $or: [
          { contact: queryRegex },
          { phone: queryRegex },
          { agent: queryRegex },
        ],
      }),
      this.contactModel.find({
        $or: [
          { name: queryRegex },
          { email: queryRegex },
          { company: queryRegex },
        ],
      }),
    ]);

    return {
      agents: agents.map((agent) => ({
        ...agent.toObject(),
        id: agent._id.toString(),
      })),
      calls: calls.map((call) => ({
        ...call.toObject(),
        id: call._id.toString(),
      })),
      contacts: contacts.map((contact) => ({
        ...contact.toObject(),
        id: contact._id.toString(),
      })),
    };
  }
}
