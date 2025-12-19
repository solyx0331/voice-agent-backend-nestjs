import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { CallsService } from "./calls.service";
import { CreateCallDto, UpdateCallDto, CallFiltersDto } from "../../dto/call.dto";

@Controller("calls")
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  async findAll(@Query() filters: CallFiltersDto) {
    return this.callsService.findAll(filters);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.callsService.findOne(id);
  }

  @Post()
  async create(@Body() createCallDto: CreateCallDto) {
    return this.callsService.create(createCallDto);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() updateCallDto: UpdateCallDto) {
    return this.callsService.update(id, updateCallDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.callsService.remove(id);
    return { message: "Call deleted successfully" };
  }

  @Post(":id/transfer")
  async transferCall(
    @Param("id") callId: string,
    @Body("targetAgentId") targetAgentId: string
  ) {
    return this.callsService.transferCall(callId, targetAgentId);
  }

  @Post(":id/hold")
  async holdCall(
    @Param("id") callId: string,
    @Body("hold") hold: boolean
  ) {
    return this.callsService.holdCall(callId, hold);
  }

  @Post(":id/whisper")
  async whisperToAgent(
    @Param("id") callId: string,
    @Body("message") message: string
  ) {
    return this.callsService.whisperToAgent(callId, message);
  }

  @Post(":id/intervene")
  async interveneInCall(@Param("id") callId: string) {
    return this.callsService.interveneInCall(callId);
  }

  @Patch(":id/sentiment")
  async updateCallSentiment(
    @Param("id") callId: string,
    @Body("sentiment") sentiment: "positive" | "neutral" | "negative"
  ) {
    return this.callsService.updateCallSentiment(callId, sentiment);
  }

  @Post(":id/end")
  async endCall(@Param("id") callId: string) {
    return this.callsService.endCall(callId);
  }

  @Post(":id/mute")
  async toggleCallMute(
    @Param("id") callId: string,
    @Body("muted") muted: boolean
  ) {
    return this.callsService.toggleCallMute(callId, muted);
  }

  @Get(":id/recording")
  async playRecording(@Param("id") callId: string) {
    return this.callsService.playRecording(callId);
  }

  @Get("export/:format")
  async exportCalls(
    @Param("format") format: "csv" | "json",
    @Res() res: Response
  ) {
    const result = await this.callsService.exportCalls(format);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`
    );
    res.send(result.data);
  }

  @Get("retell/transcripts")
  async getAllRetellTranscripts(
    @Query("limit") limit?: string,
    @Query("agentId") agentId?: string,
    @Query("startTimestamp") startTimestamp?: string,
    @Query("endTimestamp") endTimestamp?: string
  ) {
    const params: {
      limit?: number;
      agentId?: string;
      startTimestamp?: number;
      endTimestamp?: number;
    } = {};

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        params.limit = Math.min(limitNum, 1000); // Max 1000
      }
    }

    if (agentId) {
      params.agentId = agentId;
    }

    if (startTimestamp) {
      const startTs = parseInt(startTimestamp, 10);
      if (!isNaN(startTs)) {
        params.startTimestamp = startTs;
      }
    }

    if (endTimestamp) {
      const endTs = parseInt(endTimestamp, 10);
      if (!isNaN(endTs)) {
        params.endTimestamp = endTs;
      }
    }

    return this.callsService.getAllRetellTranscripts(params);
  }
}

