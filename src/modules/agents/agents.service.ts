import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { CreateAgentDto, UpdateAgentDto } from "../../dto/agent.dto";
import { RetellService } from "../../services/retell.service";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
    private retellService: RetellService
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
    let retellLlmId: string | undefined;
    let retellAgentId: string | undefined;

    // Step 1: Create LLM in Retell AI first
    // If this fails, the entire operation fails and nothing is saved
    try {
      this.logger.log(`Creating LLM in Retell for agent: ${createAgentDto.name}`);
      const retellLlm = await this.retellService.createLlm(createAgentDto);
      retellLlmId = retellLlm.llm_id;
      this.logger.log(`LLM created in Retell with ID: ${retellLlmId}`);

      // Validate LLM ID was created
      if (!retellLlmId) {
        throw new Error("LLM ID was not returned from Retell API");
      }

      // Verify LLM exists and is ready before creating agent
      this.logger.log(`Verifying LLM is ready before creating agent...`);
      let llmReady = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!llmReady && attempts < maxAttempts) {
        attempts++;
        this.logger.log(`Verifying LLM attempt ${attempts}/${maxAttempts}...`);
        llmReady = await this.retellService.verifyLlmExists(retellLlmId);
        
        if (!llmReady && attempts < maxAttempts) {
          const delay = attempts * 500; // Increasing delay: 500ms, 1000ms, 1500ms, etc.
          this.logger.log(`LLM not ready yet, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!llmReady) {
        throw new Error(`LLM ${retellLlmId} is not accessible after ${maxAttempts} attempts. Please verify the LLM was created successfully.`);
      }
      
      this.logger.log(`LLM verified and ready. Proceeding with agent creation...`);

      // Step 2: Create agent in Retell AI using the LLM
      this.logger.log(`Creating agent in Retell: ${createAgentDto.name}`);
      this.logger.log(`Using LLM ID: ${retellLlmId}`);
      const retellConfig = await this.retellService.convertToRetellConfig(createAgentDto, retellLlmId);
      this.logger.log(`Retell agent config prepared with voice_id: ${retellConfig.voice_id}`);
      const retellAgent = await this.retellService.createAgent(retellConfig);
      retellAgentId = retellAgent.agent_id;
      this.logger.log(`Agent created in Retell with ID: ${retellAgentId}`);

      // Validate agent ID was created
      if (!retellAgentId) {
        throw new Error("Agent ID was not returned from Retell API");
      }
    } catch (error) {
      this.logger.error(
        `Failed to create agent in Retell: ${error.message}`,
        error.stack
      );
      
      // Cleanup: If LLM was created but agent creation failed, delete the LLM
      if (retellLlmId && !retellAgentId) {
        this.logger.warn(
          `Attempting to delete Retell LLM ${retellLlmId} due to agent creation failure`
        );
        try {
          await this.retellService.deleteLlm(retellLlmId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell LLM: ${deleteError.message}`
          );
        }
      }
      
      // Re-throw the error to prevent saving to database
      // Agent creation fails if Retell creation fails
      throw new HttpException(
        `Failed to create agent in Retell: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Step 3: Only save to database if Retell creation was successful
    try {
      const agent = new this.agentModel({
        ...createAgentDto,
        retellAgentId,
        retellLlmId, // Store the LLM ID as well
        status: createAgentDto.status || "inactive",
        calls: 0,
        avgDuration: "0:00",
      });

      const saved = await agent.save();
      this.logger.log(`Agent saved to database with ID: ${saved._id}`);
      
      return {
        ...saved.toObject(),
        id: saved._id.toString(),
      };
    } catch (error) {
      // If database save fails, try to clean up Retell resources
      this.logger.error(
        `Failed to save agent to database: ${error.message}`,
        error.stack
      );
      
      // Cleanup Retell agent
      if (retellAgentId) {
        this.logger.warn(
          `Attempting to delete Retell agent ${retellAgentId} due to database save failure`
        );
        try {
          await this.retellService.deleteAgent(retellAgentId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell agent: ${deleteError.message}`
          );
        }
      }
      
      // Cleanup Retell LLM
      if (retellLlmId) {
        this.logger.warn(
          `Attempting to delete Retell LLM ${retellLlmId} due to database save failure`
        );
        try {
          await this.retellService.deleteLlm(retellLlmId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell LLM: ${deleteError.message}`
          );
        }
      }
      
      throw error;
    }
  }

  async update(id: string, updateAgentDto: UpdateAgentDto) {
    const agent = await this.agentModel.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Merge current agent data with updates
    const mergedAgent = {
      ...agent.toObject(),
      ...updateAgentDto,
    };

    // If agent has a Retell LLM ID, update it in Retell first
    if (agent.retellLlmId) {
      try {
        this.logger.log(`Updating LLM in Retell: ${agent.retellLlmId}`);
        
        // Build updated LLM configuration
        const llmUpdateParams = {
          begin_message: mergedAgent.baseLogic?.greetingMessage || 
                         mergedAgent.greetingScript || 
                         `Hello! I'm ${mergedAgent.name}. How can I help you today?`,
          general_prompt: this.retellService.buildGeneralPrompt(mergedAgent),
        };
        
        await this.retellService.updateLlm(agent.retellLlmId, llmUpdateParams);
        this.logger.log(`LLM updated in Retell successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to update LLM in Retell: ${error.message}`,
          error.stack
        );
        // Continue with agent update even if LLM update fails
      }
    }

    // If agent has a Retell agent ID, update it in Retell
    if (agent.retellAgentId) {
      try {
        this.logger.log(`Updating agent in Retell: ${agent.retellAgentId}`);
        
        // Map voice configuration if updated
        let voiceId: string | undefined;
        if (mergedAgent.voice) {
          if (mergedAgent.voice.type === "custom" && mergedAgent.voice.customVoiceId) {
            voiceId = mergedAgent.voice.customVoiceId;
          } else if (mergedAgent.voice.type === "generic" && mergedAgent.voice.genericVoice) {
            voiceId = this.retellService.mapGenericVoiceToRetellId(mergedAgent.voice.genericVoice);
          }
        }
        
        // Only update agent-specific fields (not LLM-related)
        const agentUpdateParams: any = {
          agent_name: mergedAgent.name,
        };
        
        if (mergedAgent.notifications?.crm?.endpoint) {
          agentUpdateParams.webhook_url = mergedAgent.notifications.crm.endpoint;
        }
        
        if (voiceId) {
          agentUpdateParams.voice_id = voiceId;
        }
        
        // Configure voicemail option if updated
        if (mergedAgent.callRules?.fallbackToVoicemail) {
          const voicemailMessage =
            mergedAgent.callRules?.voicemailMessage ||
            "Thank you for calling. Please leave a message and we'll get back to you soon.";
          agentUpdateParams.voicemail_option = {
            action: {
              type: "static_text",
              text: voicemailMessage,
            },
          };
        } else if (mergedAgent.callRules?.fallbackToVoicemail === false) {
          agentUpdateParams.voicemail_option = null;
        }
        
        await this.retellService.updateAgent(agent.retellAgentId, agentUpdateParams);
        this.logger.log(`Agent updated in Retell successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to update agent in Retell: ${error.message}`,
          error.stack
        );
        // Continue with database update even if Retell update fails
      }
    }

    // Update in database
    const updated = await this.agentModel.findByIdAndUpdate(
      id,
      { $set: updateAgentDto },
      { new: true }
    );

    return {
      ...updated.toObject(),
      id: updated._id.toString(),
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
    const agent = await this.agentModel.findById(id);

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    // Delete from Retell: First delete agent, then LLM
    if (agent.retellAgentId) {
      try {
        this.logger.log(`Deleting agent from Retell: ${agent.retellAgentId}`);
        await this.retellService.deleteAgent(agent.retellAgentId);
        this.logger.log(`Agent deleted from Retell successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to delete agent from Retell: ${error.message}`,
          error.stack
        );
        // Continue with LLM deletion even if agent deletion fails
      }
    }

    // Delete LLM from Retell
    if (agent.retellLlmId) {
      try {
        this.logger.log(`Deleting LLM from Retell: ${agent.retellLlmId}`);
        await this.retellService.deleteLlm(agent.retellLlmId);
        this.logger.log(`LLM deleted from Retell successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to delete LLM from Retell: ${error.message}`,
          error.stack
        );
        // Continue with database deletion even if Retell deletion fails
      }
    }

    // Delete from database
    await this.agentModel.findByIdAndDelete(id);
  }

  private formatDate(date: Date | string): string {
    if (typeof date === "string") return date;
    return date.toISOString().split("T")[0];
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
    return calls.map((call) => {
      const obj = call.toObject();
      return {
        ...obj,
        id: call._id.toString(),
        date: this.formatDate(call.date),
      };
    });
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

