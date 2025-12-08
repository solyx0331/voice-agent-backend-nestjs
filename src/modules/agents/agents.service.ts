import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { CreateAgentDto, UpdateAgentDto } from "../../dto/agent.dto";

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>
  ) {}

  async findAll() {
    const agents = await this.agentModel.find().sort({ createdAt: -1 });
    return agents.map((agent) => ({
      ...agent.toObject(),
      id: agent._id.toString(),
    }));
  }

  async findOne(id: string) {
    const agent = await this.agentModel.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    const calls = await this.callModel.find({
      $or: [{ agentId: id }, { agent: agent.name }],
    });

    const successfulCalls = calls.filter(
      (call) => call.outcome === "success"
    ).length;
    const successRate =
      calls.length > 0 ? (successfulCalls / calls.length) * 100 : 0;

    return {
      ...agent.toObject(),
      id: agent._id.toString(),
      totalCalls: calls.length,
      successRate: Math.round(successRate * 10) / 10,
      createdAt: agent.createdAt.toISOString().split("T")[0],
      lastActive: this.getLastActive(agent.updatedAt),
    };
  }

  async create(createAgentDto: CreateAgentDto) {
    const agent = new this.agentModel({
      ...createAgentDto,
      status: createAgentDto.status || "inactive",
      calls: 0,
      avgDuration: "0:00",
    });

    const saved = await agent.save();
    return {
      ...saved.toObject(),
      id: saved._id.toString(),
    };
  }

  async update(id: string, updateAgentDto: UpdateAgentDto) {
    const agent = await this.agentModel.findByIdAndUpdate(
      id,
      { $set: updateAgentDto },
      { new: true }
    );

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    return {
      ...agent.toObject(),
      id: agent._id.toString(),
    };
  }

  async updateStatus(id: string, status: "active" | "inactive" | "busy") {
    const agent = await this.agentModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    return {
      ...agent.toObject(),
      id: agent._id.toString(),
    };
  }

  async remove(id: string) {
    const agent = await this.agentModel.findByIdAndDelete(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
  }

  async getAgentCalls(agentId: string, limit?: number) {
    const agent = await this.agentModel.findById(agentId);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    let query = this.callModel
      .find({
        $or: [{ agentId: agentId }, { agent: agent.name }],
      })
      .sort({ createdAt: -1 });

    if (limit) {
      query = query.limit(limit);
    }

    const calls = await query;
    return calls.map((call) => ({
      ...call.toObject(),
      id: call._id.toString(),
    }));
  }

  private getLastActive(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Active now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
}

