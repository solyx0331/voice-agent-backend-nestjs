import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { CreateAgentDto, UpdateAgentDto } from "../../dto/agent.dto";
import { RetellService } from "../../services/retell.service";
import { TwilioService } from "../../services/twilio.service";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
    private retellService: RetellService,
    private twilioService: TwilioService
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
    let twilioPhoneNumberSid: string | undefined;
    let twilioPhoneNumber: string | undefined;

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

    // Step 3: Get or purchase Australian Twilio phone number
    try {
      this.logger.log(`Getting Twilio phone number for agent: ${createAgentDto.name}`);
      
      // Get list of phone numbers already assigned to other agents
      const existingAgents = await this.agentModel.find({ 
        phoneNumber: { $exists: true, $ne: null } 
      });
      const assignedPhoneNumbers = existingAgents
        .map(agent => agent.phoneNumber)
        .filter((num): num is string => !!num);
      
      this.logger.log(`Found ${assignedPhoneNumbers.length} agents with assigned phone numbers`);
      
      // Get or purchase a phone number (will check for available numbers first)
      const twilioNumber = await this.twilioService.getOrPurchasePhoneNumber(assignedPhoneNumbers);
      twilioPhoneNumberSid = twilioNumber.phoneNumberSid;
      twilioPhoneNumber = twilioNumber.phoneNumber;
      this.logger.log(`Twilio phone number configured: ${twilioPhoneNumber} (SID: ${twilioPhoneNumberSid})`);
    } catch (error) {
      this.logger.error(
        `Failed to purchase Twilio phone number: ${error.message}`,
        error.stack
      );
      
      // Cleanup Retell resources if Twilio number setup fails
      if (retellAgentId) {
        this.logger.warn(
          `Attempting to delete Retell agent ${retellAgentId} due to Twilio number setup failure`
        );
        try {
          await this.retellService.deleteAgent(retellAgentId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell agent: ${deleteError.message}`
          );
        }
      }
      
      if (retellLlmId) {
        this.logger.warn(
          `Attempting to delete Retell LLM ${retellLlmId} due to Twilio purchase failure`
        );
        try {
          await this.retellService.deleteLlm(retellLlmId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell LLM: ${deleteError.message}`
          );
        }
      }
      
      throw new HttpException(
        `Failed to purchase Twilio phone number: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Step 4: Save agent to database first to get agent ID for webhook configuration
    let savedAgentId: string;
    try {
      const agent = new this.agentModel({
        ...createAgentDto,
        retellAgentId,
        retellLlmId,
        phoneNumber: twilioPhoneNumber,
        twilioPhoneNumberSid: twilioPhoneNumberSid,
        status: createAgentDto.status || "inactive",
        calls: 0,
        avgDuration: "0:00",
      });

      const saved = await agent.save();
      savedAgentId = saved._id.toString();
      this.logger.log(`Agent saved to database with ID: ${savedAgentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to save agent to database: ${error.message}`,
        error.stack
      );
      
      // Cleanup Twilio number if database save fails
      if (twilioPhoneNumberSid) {
        this.logger.warn(
          `Attempting to release Twilio number ${twilioPhoneNumberSid} due to database save failure`
        );
        try {
          await this.twilioService.releasePhoneNumber(twilioPhoneNumberSid);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Twilio number: ${deleteError.message}`
          );
        }
      }
      
      // Cleanup Retell resources
      if (retellAgentId) {
        try {
          await this.retellService.deleteAgent(retellAgentId);
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup Retell agent: ${deleteError.message}`
          );
        }
      }
      
      if (retellLlmId) {
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

    // Step 5: Configure webhook for the Twilio phone number
    let webhookUrl: string | undefined;
    try {
      this.logger.log(`Configuring webhook for Twilio number: ${twilioPhoneNumberSid}`);
      const webhookConfig = await this.twilioService.configureWebhook(
        twilioPhoneNumberSid!,
        savedAgentId
      );
      webhookUrl = webhookConfig.webhookUrl;
      this.logger.log(`Webhook configured: ${webhookUrl}`);
      
      // Update agent with webhook URL
      await this.agentModel.findByIdAndUpdate(savedAgentId, {
        webhookUrl: webhookUrl,
      });
      this.logger.log(`Agent updated with webhook URL`);
    } catch (error) {
      this.logger.error(
        `Failed to configure Twilio webhook: ${error.message}`,
        error.stack
      );
      // Don't fail the entire operation - agent is created, just webhook config failed
      // Log warning but continue
      this.logger.warn(
        `Agent created but webhook configuration failed. You may need to configure it manually.`
      );
    }

    // Step 6: Return the complete agent data
    const finalAgent = await this.agentModel.findById(savedAgentId);
    if (!finalAgent) {
      throw new HttpException(
        "Agent was created but could not be retrieved",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return {
      ...finalAgent.toObject(),
      id: finalAgent._id.toString(),
    };
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
          // Ensure smooth conversation flow with appropriate temperature
          model_temperature: 0.7,
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
        // Check both updateAgentDto and mergedAgent to catch voice-only updates
        let voiceId: string | undefined;
        const voiceConfig = updateAgentDto.voice || mergedAgent.voice;
        if (voiceConfig) {
          if (voiceConfig.type === "custom" && voiceConfig.customVoiceId) {
            voiceId = voiceConfig.customVoiceId;
            this.logger.log(`Using custom voice ID: ${voiceId}`);
          } else if (voiceConfig.type === "generic" && voiceConfig.genericVoice) {
            // The genericVoice contains the display_name (e.g., "ElevenLabs - Aria")
            // We need to look up the actual voice_id from Retell
            this.logger.log(`Mapping display name to voice_id: ${voiceConfig.genericVoice}`);
            voiceId = await this.retellService.mapDisplayNameToVoiceId(voiceConfig.genericVoice);
            this.logger.log(`Mapped to voice_id: ${voiceId}`);
          }
        } else {
          this.logger.log(`No voice configuration in update - keeping existing voice`);
        }
        
        // Only update agent-specific fields (not LLM-related)
        const agentUpdateParams: any = {
          agent_name: mergedAgent.name,
        };
        
        if (mergedAgent.notifications?.crm?.endpoint) {
          agentUpdateParams.webhook_url = mergedAgent.notifications.crm.endpoint;
        }
        
        // Always include voice_id if we have it (even if unchanged, to ensure it's set)
        // If voice was updated, use the new voiceId; otherwise keep existing voice
        if (voiceId) {
          agentUpdateParams.voice_id = voiceId;
          this.logger.log(`Setting voice_id in Retell update: ${voiceId}`);
        } else if (agent.voice) {
          // If no new voice specified but agent has existing voice, preserve it
          if (agent.voice.type === "custom" && agent.voice.customVoiceId) {
            agentUpdateParams.voice_id = agent.voice.customVoiceId;
            this.logger.log(`Preserving existing custom voice_id: ${agent.voice.customVoiceId}`);
          } else if (agent.voice.type === "generic" && agent.voice.genericVoice) {
            // Map existing generic voice to voice_id
            agentUpdateParams.voice_id = await this.retellService.mapDisplayNameToVoiceId(agent.voice.genericVoice);
            this.logger.log(`Preserving existing generic voice_id: ${agentUpdateParams.voice_id}`);
          }
        }

        // Voice settings (if provided) - check both update DTO and merged agent
        const voiceSettings = updateAgentDto.voice || mergedAgent.voice;
        if (voiceSettings) {
          const voice = voiceSettings as any; // Type assertion for voice settings
          if (voice.temperature !== undefined) {
            agentUpdateParams.voice_temperature = Math.max(0, Math.min(2, voice.temperature));
            this.logger.log(`Updating voice_temperature: ${agentUpdateParams.voice_temperature}`);
          } else if (!mergedAgent.voice?.temperature) {
            // Set default if not previously set
            agentUpdateParams.voice_temperature = 0.7;
            this.logger.log(`Setting default voice_temperature: ${agentUpdateParams.voice_temperature}`);
          }
          if (voice.speed !== undefined) {
            agentUpdateParams.voice_speed = Math.max(0.5, Math.min(2, voice.speed));
            this.logger.log(`Updating voice_speed: ${agentUpdateParams.voice_speed}`);
          } else if (!mergedAgent.voice?.speed) {
            // Set default if not previously set (slower pace for natural speech with breath control)
            agentUpdateParams.voice_speed = 0.85;
            this.logger.log(`Setting default voice_speed: ${agentUpdateParams.voice_speed}`);
          }
          if (voice.volume !== undefined) {
            agentUpdateParams.volume = Math.max(0, Math.min(2, voice.volume));
            this.logger.log(`Updating volume: ${agentUpdateParams.volume}`);
          } else if (!mergedAgent.voice?.volume) {
            // Set default if not previously set
            agentUpdateParams.volume = 1.0;
            this.logger.log(`Setting default volume: ${agentUpdateParams.volume}`);
          }
        } else {
          // No voice settings at all, set defaults to prevent speech issues
          agentUpdateParams.voice_temperature = 0.7;
          agentUpdateParams.voice_speed = 0.85;
          agentUpdateParams.volume = 1.0;
          this.logger.log(`Setting default voice settings: temperature=0.7, speed=0.85, volume=1.0`);
        }
        
        // Agent behavior settings (with defaults for smooth flow)
        if (mergedAgent.responsiveness !== undefined) {
          agentUpdateParams.responsiveness = Math.max(0, Math.min(1, mergedAgent.responsiveness));
        } else {
          // Default to 0.8 for smooth, responsive conversation
          agentUpdateParams.responsiveness = 0.8;
          this.logger.log(`Setting default responsiveness: ${agentUpdateParams.responsiveness}`);
        }
        if (mergedAgent.interruptionSensitivity !== undefined) {
          agentUpdateParams.interruption_sensitivity = Math.max(0, Math.min(1, mergedAgent.interruptionSensitivity));
        } else {
          // Default to 0.5 for balanced interruption handling
          agentUpdateParams.interruption_sensitivity = 0.5;
          this.logger.log(`Setting default interruption_sensitivity: ${agentUpdateParams.interruption_sensitivity}`);
        }

        // Call management settings (if provided)
        if (mergedAgent.endCallAfterSilenceMs !== undefined) {
          agentUpdateParams.end_call_after_silence_ms = Math.max(10000, mergedAgent.endCallAfterSilenceMs);
        }
        if (mergedAgent.maxCallDurationMs !== undefined) {
          agentUpdateParams.max_call_duration_ms = Math.max(60000, Math.min(7200000, mergedAgent.maxCallDurationMs));
        }
        if (mergedAgent.beginMessageDelayMs !== undefined) {
          agentUpdateParams.begin_message_delay_ms = Math.max(0, Math.min(5000, mergedAgent.beginMessageDelayMs));
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

    // Release Twilio phone number if exists
    if (agent.twilioPhoneNumberSid) {
      try {
        this.logger.log(`Releasing Twilio phone number: ${agent.twilioPhoneNumberSid}`);
        await this.twilioService.releasePhoneNumber(agent.twilioPhoneNumberSid);
        this.logger.log(`Twilio phone number released successfully`);
      } catch (error) {
        this.logger.error(
          `Failed to release Twilio phone number: ${error.message}`,
          error.stack
        );
        // Continue with deletion even if Twilio release fails
      }
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

    // Get calls for this agent
    const calls = await this.callModel
      .find({
        $or: [
          { agentId: new Types.ObjectId(agentId) },
          { agent: agent.name },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit || 100)
      .exec();

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

