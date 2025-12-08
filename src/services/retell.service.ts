import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Retell from "retell-sdk";
import type {
  AgentCreateParams,
  AgentUpdateParams,
  AgentResponse,
} from "retell-sdk/resources/agent";
import type {
  LlmCreateParams,
  LlmUpdateParams,
  LlmResponse,
} from "retell-sdk/resources/llm";

@Injectable()
export class RetellService {
  private readonly logger = new Logger(RetellService.name);
  private readonly client: Retell;

  constructor(private configService: ConfigService) {
    const apiKey =
      process.env.RETELL_API_KEY ||
      this.configService.get<string>("RETELL_API_KEY") ||
      "";

    if (!apiKey) {
      this.logger.warn(
        "RETELL_API_KEY not found. Retell integration will not work."
      );
    }

    // Initialize Retell SDK client
    this.client = new Retell({
      apiKey: apiKey,
    });
  }

  /**
   * Create a Retell LLM dynamically for an agent
   * @param createAgentDto Agent DTO containing LLM configuration
   * @returns Retell LLM ID and details
   */
  async createLlm(createAgentDto: any): Promise<LlmResponse> {
    try {
      this.logger.log(`Creating Retell LLM for agent: ${createAgentDto.name}`);

      // Build LLM configuration from agent DTO
      const llmConfig: LlmCreateParams = {
        // Set who starts the conversation (agent speaks first)
        start_speaker: "agent",
        
        // Set the first message (greeting)
        begin_message: createAgentDto.baseLogic?.greetingMessage || 
                       createAgentDto.greetingScript || 
                       `Hello! I'm ${createAgentDto.name}. How can I help you today?`,
        
        // Build general prompt from agent configuration
        general_prompt: this.buildGeneralPrompt(createAgentDto),
        
        // Set model (default to gpt-4.1 if not specified)
        model: "gpt-4.1",
        
        // Set temperature for more deterministic responses (good for tool calling)
        model_temperature: 0.2,
      };

      // Use Retell SDK to create LLM
      const llmResponse = await this.client.llm.create(llmConfig);

      this.logger.log(`Retell LLM created successfully: ${llmResponse.llm_id}`);
      return llmResponse;
    } catch (error: any) {
      this.logger.error(
        `Error creating Retell LLM: ${error.message}`,
        error.stack
      );

      // Handle SDK errors
      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to create LLM in Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to create LLM in Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update a Retell LLM
   * @param llmId Retell LLM ID
   * @param updateParams Updated LLM configuration
   * @returns Updated LLM details
   */
  async updateLlm(
    llmId: string,
    updateParams: LlmUpdateParams
  ): Promise<LlmResponse> {
    try {
      this.logger.log(`Updating Retell LLM: ${llmId}`);

      const llmResponse = await this.client.llm.update(llmId, updateParams);

      this.logger.log(`Retell LLM updated successfully: ${llmId}`);
      return llmResponse;
    } catch (error: any) {
      this.logger.error(
        `Error updating Retell LLM: ${error.message}`,
        error.stack
      );

      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to update LLM in Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to update LLM in Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete a Retell LLM
   * @param llmId Retell LLM ID
   */
  async deleteLlm(llmId: string): Promise<void> {
    try {
      this.logger.log(`Deleting Retell LLM: ${llmId}`);

      await this.client.llm.delete(llmId);

      this.logger.log(`Retell LLM deleted successfully: ${llmId}`);
    } catch (error: any) {
      this.logger.error(
        `Error deleting Retell LLM: ${error.message}`,
        error.stack
      );

      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to delete LLM from Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to delete LLM from Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Build general prompt from agent configuration
   * @param createAgentDto Agent DTO
   * @returns Formatted prompt string
   */
  buildGeneralPrompt(createAgentDto: any): string {
    let prompt = "";

    // Agent name and description
    if (createAgentDto.description) {
      prompt += `You are ${createAgentDto.name}, a voice AI assistant. ${createAgentDto.description}\n\n`;
    } else {
      prompt += `You are ${createAgentDto.name}, a professional voice AI assistant.\n\n`;
    }

    // FAQs
    if (createAgentDto.faqs && createAgentDto.faqs.length > 0) {
      prompt += "Here are some frequently asked questions and their answers:\n";
      createAgentDto.faqs.forEach((faq: any, index: number) => {
        prompt += `${index + 1}. Q: ${faq.question}\n   A: ${faq.answer}\n`;
      });
      prompt += "\n";
    }

    // Intents
    if (createAgentDto.intents && createAgentDto.intents.length > 0) {
      prompt += "When users express these intents, respond accordingly:\n";
      createAgentDto.intents.forEach((intent: any) => {
        prompt += `- ${intent.name}: ${intent.prompt}`;
        if (intent.response) {
          prompt += ` Response: ${intent.response}`;
        }
        prompt += "\n";
      });
      prompt += "\n";
    }

    // Base logic
    if (createAgentDto.baseLogic) {
      if (createAgentDto.baseLogic.primaryIntentPrompts?.length > 0) {
        prompt += "Primary intents to handle:\n";
        createAgentDto.baseLogic.primaryIntentPrompts.forEach((intent: string, index: number) => {
          prompt += `${index + 1}. ${intent}\n`;
        });
        prompt += "\n";
      }

      if (createAgentDto.baseLogic.responseLogic?.length > 0) {
        prompt += "Response logic:\n";
        createAgentDto.baseLogic.responseLogic.forEach((logic: any) => {
          prompt += `- If ${logic.condition}, then ${logic.action}: ${logic.response}\n`;
        });
        prompt += "\n";
      }
    }

    // Lead capture instructions
    if (createAgentDto.leadCapture?.fields && createAgentDto.leadCapture.fields.length > 0) {
      prompt += "During the conversation, collect the following information:\n";
      createAgentDto.leadCapture.fields.forEach((field: any) => {
        prompt += `- ${field.name} (${field.type}): ${field.question}`;
        if (field.required) {
          prompt += " [Required]";
        }
        prompt += "\n";
      });
      prompt += "\n";
    }

    // General instructions
    prompt += "Be professional, helpful, and concise. Keep responses natural and conversational.";

    return prompt;
  }

  /**
   * Create an agent in Retell AI using the Retell SDK
   * Reference: https://docs.retellai.com/api-references/create-agent
   * @param config Agent configuration
   * @returns Retell agent ID and details
   */
  async createAgent(config: AgentCreateParams): Promise<AgentResponse> {
    try {
      this.logger.log(`Creating Retell agent: ${config.agent_name || "Unnamed"}`);

      // Use Retell SDK to create agent
      const agentResponse = await this.client.agent.create(config);

      this.logger.log(`Retell agent created successfully: ${agentResponse.agent_id}`);
      return agentResponse;
    } catch (error: any) {
      this.logger.error(
        `Error creating Retell agent: ${error.message}`,
        error.stack
      );

      // Handle SDK errors
      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to create agent in Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to create agent in Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update an agent in Retell AI using the Retell SDK
   * Reference: https://docs.retellai.com/api-references/update-agent
   * @param agentId Retell agent ID
   * @param config Updated agent configuration
   * @returns Updated agent details
   */
  async updateAgent(
    agentId: string,
    config: AgentUpdateParams
  ): Promise<AgentResponse> {
    try {
      this.logger.log(`Updating Retell agent: ${agentId}`);

      // Use Retell SDK to update agent
      const agentResponse = await this.client.agent.update(agentId, config);

      this.logger.log(`Retell agent updated successfully: ${agentId}`);
      return agentResponse;
    } catch (error: any) {
      this.logger.error(
        `Error updating Retell agent: ${error.message}`,
        error.stack
      );

      // Handle SDK errors
      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to update agent in Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to update agent in Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete an agent from Retell AI using the Retell SDK
   * Reference: https://docs.retellai.com/api-references/delete-agent
   * @param agentId Retell agent ID
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      this.logger.log(`Deleting Retell agent: ${agentId}`);

      // Use Retell SDK to delete agent
      await this.client.agent.delete(agentId);

      this.logger.log(`Retell agent deleted successfully: ${agentId}`);
    } catch (error: any) {
      this.logger.error(
        `Error deleting Retell agent: ${error.message}`,
        error.stack
      );

      // Handle SDK errors
      if (error.status || error.statusCode) {
        throw new HttpException(
          `Failed to delete agent in Retell: ${error.message || "Unknown error"}`,
          error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      throw new HttpException(
        `Failed to delete agent in Retell: ${error.message || "Unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Convert our agent DTO to Retell agent configuration
   * Based on Retell API documentation: https://docs.retellai.com/api-references/create-agent
   * @param createAgentDto Agent DTO from frontend
   * @param llmId The Retell LLM ID to use (created dynamically)
   * @returns Retell agent configuration
   */
  convertToRetellConfig(createAgentDto: any, llmId: string): AgentCreateParams {
    if (!llmId) {
      throw new HttpException(
        "LLM ID is required. Please create a Retell LLM first.",
        HttpStatus.BAD_REQUEST
      );
    }

    // Required fields
    const config: AgentCreateParams = {
      response_engine: {
        type: "retell-llm",
        llm_id: llmId, // Use the dynamically created LLM ID
      },
      voice_id: "", // Will be set below
      agent_name: createAgentDto.name,
      language: "en-US", // Default language - must be a valid language code
    };

    // Map voice configuration - voice_id is required
    if (createAgentDto.voice) {
      if (createAgentDto.voice.type === "custom" && createAgentDto.voice.customVoiceId) {
        config.voice_id = createAgentDto.voice.customVoiceId;
      } else if (createAgentDto.voice.type === "generic" && createAgentDto.voice.genericVoice) {
        // Map generic voice name to Retell voice ID
        config.voice_id = this.mapGenericVoiceToRetellId(createAgentDto.voice.genericVoice);
      }
    }

    // If no voice_id is set, use a default
    if (!config.voice_id) {
      config.voice_id = "11labs-Adrian"; // Default Retell voice
      this.logger.warn("No voice_id specified, using default: 11labs-Adrian");
    }

    // Set webhook URL if notifications are configured
    if (createAgentDto.notifications?.crm?.endpoint) {
      config.webhook_url = createAgentDto.notifications.crm.endpoint;
    }

    // Configure voicemail option if enabled
    if (createAgentDto.callRules?.fallbackToVoicemail) {
      const voicemailMessage =
        createAgentDto.callRules?.voicemailMessage ||
        "Thank you for calling. Please leave a message and we'll get back to you soon.";
      
      config.voicemail_option = {
        action: {
          type: "static_text",
          text: voicemailMessage,
        },
      };
    } else {
      config.voicemail_option = null; // Disable voicemail detection
    }

    // Set optional configuration
    config.normalize_for_speech = true; // Normalize numbers, dates, etc. for better speech
    config.stt_mode = "fast"; // Use fast mode for lower latency
    config.vocab_specialization = "general"; // Use general vocabulary

    // Set call duration limits (optional)
    config.end_call_after_silence_ms = 600000; // 10 minutes default
    config.max_call_duration_ms = 3600000; // 1 hour default

    // Set begin message delay if needed
    config.begin_message_delay_ms = 1000; // 1 second delay

    return config;
  }

  /**
   * Map generic voice names to Retell voice IDs
   * Based on Retell's available voices (ElevenLabs, OpenAI, Deepgram, etc.)
   * Reference: https://docs.retellai.com/api-references/list-voices
   */
  mapGenericVoiceToRetellId(genericVoice: string): string {
    // Map common voice names to Retell voice IDs
    // Retell voice IDs follow the pattern: "provider-VoiceName"
    // Common providers: 11labs, openai, deepgram
    const voiceMap: Record<string, string> = {
      // ElevenLabs voices
      "ElevenLabs - Aria": "11labs-Aria",
      "ElevenLabs - Adam": "11labs-Adam",
      "ElevenLabs - Antoni": "11labs-Antoni",
      "ElevenLabs - Arnold": "11labs-Arnold",
      "ElevenLabs - Bella": "11labs-Bella",
      "ElevenLabs - Domi": "11labs-Domi",
      "ElevenLabs - Elli": "11labs-Elli",
      "ElevenLabs - Josh": "11labs-Josh",
      "ElevenLabs - Rachel": "11labs-Rachel",
      "ElevenLabs - Sam": "11labs-Sam",
      // OpenAI voices
      "OpenAI - Alloy": "openai-Alloy",
      "OpenAI - Echo": "openai-Echo",
      "OpenAI - Fable": "openai-Fable",
      "OpenAI - Onyx": "openai-Onyx",
      "OpenAI - Nova": "openai-Nova",
      "OpenAI - Shimmer": "openai-Shimmer",
      // Deepgram voices
      "Deepgram - Asteria": "deepgram-Asteria",
      "Deepgram - Luna": "deepgram-Luna",
      "Deepgram - Atlas": "deepgram-Atlas",
      "Deepgram - Angus": "deepgram-Angus",
    };

    // If exact match found, return it
    if (voiceMap[genericVoice]) {
      return voiceMap[genericVoice];
    }

    // Try to extract provider and voice name if format is "Provider - VoiceName"
    const match = genericVoice.match(/(.+?)\s*-\s*(.+)/);
    if (match) {
      const provider = match[1].toLowerCase().replace(/\s+/g, "");
      const voiceName = match[2].trim();
      
      // Map common provider names
      const providerMap: Record<string, string> = {
        elevenlabs: "11labs",
        openai: "openai",
        deepgram: "deepgram",
      };

      const retellProvider = providerMap[provider] || provider;
      return `${retellProvider}-${voiceName}`;
    }

    // Default fallback
    this.logger.warn(
      `Unknown voice: ${genericVoice}, using default: 11labs-Adrian`
    );
    return "11labs-Adrian";
  }
}

