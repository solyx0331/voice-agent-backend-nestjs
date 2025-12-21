import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query
} from "@nestjs/common";
import { AgentsService } from "./agents.service";
import { CreateAgentDto, UpdateAgentDto } from "../../dto/agent.dto";

@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async findAll() {
    console.log("findAll ==> ");
    return this.agentsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.agentsService.findOne(id);
  }

  @Get(":id/calls")
  async getAgentCalls(
    @Param("id") id: string,
    @Query("limit") limit?: number
  ) {
    return this.agentsService.getAgentCalls(id, limit ? parseInt(limit.toString()) : undefined);
  }

  @Post()
  async create(@Body() createAgentDto: CreateAgentDto) {
    return this.agentsService.create(createAgentDto);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateAgentDto: UpdateAgentDto
  ) {
    return this.agentsService.update(id, updateAgentDto);
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: "active" | "inactive" | "busy"
  ) {
    return this.agentsService.updateStatus(id, status);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.agentsService.remove(id);
    return { message: "Agent deleted successfully" };
  }

  @Post(":id/test/web-call")
  async createWebCallTest(@Param("id") id: string) {
    return this.agentsService.createWebCallTest(id);
  }
}

