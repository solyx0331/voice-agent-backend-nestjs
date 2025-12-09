import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Call, CallDocument } from "../../schemas/call.schema";
import { CreateCallDto, UpdateCallDto, CallFiltersDto } from "../../dto/call.dto";

@Injectable()
export class CallsService {
  constructor(
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>
  ) {}

  private formatDate(date: Date | string): string {
    if (typeof date === "string") return date;
    return date.toISOString().split("T")[0];
  }

  async findAll(filters?: CallFiltersDto) {
    const query: any = {};

    if (filters?.search) {
      query.$or = [
        { contact: { $regex: filters.search, $options: "i" } },
        { phone: { $regex: filters.search, $options: "i" } },
        { agent: { $regex: filters.search, $options: "i" } },
      ];
    }

    if (filters?.agent) {
      query.agent = filters.agent;
    }

    // Support filtering by agentId if provided
    if (filters?.agentId) {
      query.agentId = filters.agentId;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.start && filters?.end) {
      query.date = {
        $gte: new Date(filters.start),
        $lte: new Date(filters.end),
      };
    }

    const calls = await this.callModel.find(query).sort({ createdAt: -1 });
    return calls.map((call) => {
      const obj = call.toObject();
      return {
        ...obj,
        id: call._id.toString(),
        date: this.formatDate(call.date),
        agentId: call.agentId?.toString(),
        // Ensure transcript is in the expected format
        transcript: call.transcript || [],
      };
    });
  }

  /**
   * Get calls for a specific agent
   * @param agentId Agent ID
   * @param limit Optional limit for number of calls
   */
  async getAgentCalls(agentId: string, limit?: number) {
    const query: any = { agentId: new Types.ObjectId(agentId) };
    const calls = await this.callModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit || 100);

    return calls.map((call) => {
      const obj = call.toObject();
      return {
        ...obj,
        id: call._id.toString(),
        date: this.formatDate(call.date),
        agentId: call.agentId?.toString(),
        transcript: call.transcript || [],
      };
    });
  }

  async findOne(id: string) {
    const call = await this.callModel.findById(id);

    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }

    const obj = call.toObject();
    return {
      ...obj,
      id: call._id.toString(),
      date: this.formatDate(call.date),
      agentId: call.agentId?.toString(),
      // Ensure transcript is in the expected format
      transcript: call.transcript || [],
    };
  }

  async create(createCallDto: CreateCallDto) {
    const callData: any = {
      ...createCallDto,
      date: new Date(createCallDto.date),
    };

    // Convert agentId string to ObjectId if provided
    if (createCallDto.agentId && Types.ObjectId.isValid(createCallDto.agentId)) {
      callData.agentId = new Types.ObjectId(createCallDto.agentId);
    }

    const call = new this.callModel(callData);
    const saved = await call.save();
    const obj = saved.toObject();
    return {
      ...obj,
      id: saved._id.toString(),
      date: this.formatDate(saved.date),
      agentId: saved.agentId?.toString(),
    };
  }

  async update(id: string, updateCallDto: UpdateCallDto) {
    const call = await this.callModel.findByIdAndUpdate(
      id,
      { $set: updateCallDto },
      { new: true }
    );

    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }

    const obj = call.toObject();
    return {
      ...obj,
      id: call._id.toString(),
      date: this.formatDate(call.date),
      agentId: call.agentId?.toString(),
    };
  }

  async remove(id: string) {
    const call = await this.callModel.findByIdAndDelete(id);

    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
  }

  async transferCall(callId: string, targetAgentId: string) {
    // In a real implementation, this would integrate with a call management system
    return { message: "Call transfer initiated", callId, targetAgentId };
  }

  async holdCall(callId: string, hold: boolean) {
    // In a real implementation, this would control the call state
    return { message: hold ? "Call put on hold" : "Call resumed", callId };
  }

  async whisperToAgent(callId: string, message: string) {
    // In a real implementation, this would send a whisper message
    return { message: "Whisper sent", callId, whisperMessage: message };
  }

  async interveneInCall(callId: string) {
    // In a real implementation, this would allow human intervention
    return { message: "Intervention initiated", callId };
  }

  async updateCallSentiment(
    callId: string,
    sentiment: "positive" | "neutral" | "negative"
  ) {
    const call = await this.callModel.findById(callId);

    if (!call) {
      throw new NotFoundException(`Call with ID ${callId} not found`);
    }

    // Store sentiment in a separate field or extend the entity
    return { message: "Sentiment updated", callId, sentiment };
  }

  async endCall(callId: string) {
    // In a real implementation, this would end the active call
    return { message: "Call ended", callId };
  }

  async toggleCallMute(callId: string, muted: boolean) {
    // In a real implementation, this would toggle mute
    return { message: muted ? "Call muted" : "Call unmuted", callId };
  }

  async playRecording(callId: string) {
    const call = await this.callModel.findById(callId);

    if (!call) {
      throw new NotFoundException(`Call with ID ${callId} not found`);
    }

    if (!call.recording) {
      throw new NotFoundException(`No recording found for call ${callId}`);
    }

    // In a real implementation, this would return the actual recording URL
    return { url: `/uploads/recordings/${callId}.mp3` };
  }

  async exportCalls(format: "csv" | "json" = "csv") {
    const calls = await this.callModel.find();

    if (format === "csv") {
      const headers = [
        "Contact",
        "Phone",
        "Agent",
        "Type",
        "Duration",
        "Date",
        "Time",
        "Status",
      ];
      const rows = calls.map((call) => [
        call.contact,
        call.phone,
        call.agent,
        call.type,
        call.duration,
        call.date.toISOString().split("T")[0],
        call.time,
        call.status,
      ]);

      return {
        data: [headers.join(","), ...rows.map((row) => row.join(","))].join("\n"),
        contentType: "text/csv",
        filename: `calls_${new Date().toISOString()}.csv`,
      };
    } else {
      return {
        data: JSON.stringify(
          calls.map((call) => ({
            ...call.toObject(),
            id: call._id.toString(),
          })),
          null,
          2
        ),
        contentType: "application/json",
        filename: `calls_${new Date().toISOString()}.json`,
      };
    }
  }
}
