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

  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey =
      process.env.RETELL_API_KEY ||
      this.configService.get<string>("RETELL_API_KEY") ||
      "";

    if (!this.apiKey) {
      this.logger.warn(
        "RETELL_API_KEY not found. Retell integration will not work."
      );
    }

    this.logger.log(`Retell API Key: ${this.apiKey}`);
    // Initialize Retell SDK client
    this.client = new Retell({
      apiKey: this.apiKey,
    });
  }

  /**
   * Create a Retell LLM dynamically for an agent
   * @param createAgentDto Agent DTO containing LLM configuration
   * @returns Retell LLM ID and details
   */
  async createLlm(createAgentDto: any): Promise<LlmResponse> {
    if (!this.apiKey) {
      throw new HttpException(
        "RETELL_API_KEY is not configured. Please set RETELL_API_KEY environment variable.",
        HttpStatus.UNAUTHORIZED
      );
    }

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

      this.logger.debug(`LLM config: ${JSON.stringify(llmConfig, null, 2)}`);

      // Use Retell SDK to create LLM
      const llmResponse = await this.client.llm.create(llmConfig);

      this.logger.log(`Retell LLM created successfully: ${llmResponse.llm_id}`);
      return llmResponse;
    } catch (error: any) {
      this.logger.error(
        `Error creating Retell LLM: ${error.message}`,
        error.stack
      );

      // Log more details about the error
      if (error.response) {
        this.logger.error(`Retell API response: ${JSON.stringify(error.response, null, 2)}`);
      }
      if (error.status || error.statusCode) {
        this.logger.error(`HTTP Status: ${error.status || error.statusCode}`);
      }

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

    // Custom system prompt (if provided, use it as the base)
    if (createAgentDto.systemPrompt) {
      prompt += `${createAgentDto.systemPrompt}\n\n`;
    }

    // Agent name and description
    if (createAgentDto.description) {
      prompt += `You are ${createAgentDto.name}, a voice AI assistant. ${createAgentDto.description}\n\n`;
    } else {
      prompt += `You are ${createAgentDto.name}, a professional voice AI assistant.\n\n`;
    }

    // Base logic - greeting message and routing logic
    if (createAgentDto.baseLogic) {
      if (createAgentDto.baseLogic.greetingMessage) {
        prompt += `Initial Greeting: ${createAgentDto.baseLogic.greetingMessage}\n\n`;
      }

      // New routingLogics structure (each block contains routing rules + information gathering + lead capture)
      if (createAgentDto.baseLogic.routingLogics && createAgentDto.baseLogic.routingLogics.length > 0) {
        prompt += "Routing Logic Blocks:\n";
        
        // Recursive function to build routing logic prompt
        const buildRoutingPrompt = (routings: any[], depth: number = 0) => {
          const indent = "  ".repeat(depth);
          routings.forEach((routing: any, index: number) => {
            const blockLabel = depth === 0 ? `Routing Block ${index + 1}` : `Nested Routing ${index + 1}`;
            prompt += `\n${indent}${blockLabel} (${routing.name || `Route ${index + 1}`}):\n`;
            prompt += `${indent}- Condition: ${routing.condition}\n`;
            prompt += `${indent}- Action: ${routing.action}\n`;
            prompt += `${indent}- Response: ${routing.response}\n`;
            
            // Information gathering for this routing block
            if (routing.informationGathering && routing.informationGathering.length > 0) {
              prompt += `${indent}- Information Gathering Questions for this route:\n`;
              routing.informationGathering.forEach((item: any) => {
                prompt += `${indent}  * ${item.question}\n`;
              });
            }
            
            // Lead capture fields for this routing block
            if (routing.leadCaptureFields && routing.leadCaptureFields.length > 0) {
              prompt += `${indent}- Lead Capture Fields for this route:\n`;
              routing.leadCaptureFields.forEach((field: any) => {
                prompt += `${indent}  * ${field.name} (${field.type}): ${field.question}`;
                if (field.required) {
                  prompt += " [Required]";
                }
                prompt += "\n";
              });
            }
            
            // Completion response after collecting information
            if (routing.completionResponse) {
              prompt += `${indent}- Completion Response (say this after collecting all information and lead data): ${routing.completionResponse}\n`;
            }
            
            // Recursively process nested routing logic
            if (routing.routingLogics && routing.routingLogics.length > 0) {
              prompt += `${indent}- Nested Routing Logic:\n`;
              buildRoutingPrompt(routing.routingLogics, depth + 1);
            }
          });
        };
        
        buildRoutingPrompt(createAgentDto.baseLogic.routingLogics);
        prompt += "\n";
      }

      // Legacy support for old responseLogic structure
      if (createAgentDto.baseLogic.responseLogic?.length > 0 && !createAgentDto.baseLogic.routingLogics) {
        prompt += "Routing and Response Logic:\n";
        createAgentDto.baseLogic.responseLogic.forEach((logic: any) => {
          prompt += `- If ${logic.condition}, then ${logic.action}: ${logic.response}\n`;
        });
        prompt += "\n";
      }

      // Legacy support for old primaryIntentPrompts
      if (createAgentDto.baseLogic.primaryIntentPrompts?.length > 0) {
        prompt += "Primary intents to handle:\n";
        createAgentDto.baseLogic.primaryIntentPrompts.forEach((intent: string, index: number) => {
          prompt += `${index + 1}. ${intent}\n`;
        });
        prompt += "\n";
      }
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

    // Lead capture instructions (legacy support - if not using routingLogics structure)
    if (!createAgentDto.baseLogic?.routingLogics || createAgentDto.baseLogic.routingLogics.length === 0) {
      const leadCaptureFields = createAgentDto.leadCapture?.fields || [];
      const leadCaptureQuestions = createAgentDto.baseLogic?.leadCaptureQuestions || [];
      
      if (leadCaptureFields.length > 0 || leadCaptureQuestions.length > 0) {
        prompt += "During the conversation, collect the following information:\n";
        
        // Add fields from leadCapture configuration
        leadCaptureFields.forEach((field: any) => {
          prompt += `- ${field.name} (${field.type}): ${field.question}`;
          if (field.required) {
            prompt += " [Required]";
          }
          prompt += "\n";
        });
        
        // Add questions from baseLogic
        leadCaptureQuestions.forEach((item: any) => {
          if (item.question) {
            prompt += `- ${item.question}\n`;
          }
        });
        
        prompt += "\n";
      }
    }

    // Fallback and escalation rules
    prompt += "Fallback Rules:\n";
    prompt += "- If you don't understand the caller's response after asking twice, politely say: 'I'm sorry, I'm having trouble understanding you. Would you like to speak to a human representative instead?'\n";
    prompt += "- Be patient and ask for clarification when needed.\n";
    prompt += "- If the caller wants to speak to a human, acknowledge this and note it in the summary.\n\n";

    // General instructions
    prompt += "Be professional, helpful, and concise. Keep responses natural and conversational. ";
    prompt += "Always collect the required information before ending the call. ";
    prompt += "At the end of the call, provide a clear summary of the conversation including all collected information.";

    return prompt;
  }

  /**
   * Verify that an LLM exists and is ready
   * @param llmId The LLM ID to verify
   * @returns True if LLM exists and is ready
   */
  async verifyLlmExists(llmId: string): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      this.logger.log(`Verifying LLM exists: ${llmId}`);
      const llm = await this.client.llm.retrieve(llmId);
      this.logger.log(`LLM verified successfully: ${llm.llm_id}`);
      return true;
    } catch (error: any) {
      this.logger.error(`LLM verification failed: ${error.message}`);
      if (error.status === 404 || error.statusCode === 404) {
        this.logger.error(`LLM ${llmId} does not exist or was deleted`);
      }
      return false;
    }
  }

  /**
   * Verify that a voice ID exists in the Retell account
   * @param voiceId The voice ID to verify
   * @returns True if voice exists, false otherwise
   */
  async verifyVoiceExists(voiceId: string): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      this.logger.log(`Verifying voice exists: ${voiceId}`);
      const voice = await this.client.voice.retrieve(voiceId);
      this.logger.log(`Voice verified successfully: ${voice.voice_id} (${voice.voice_name} from ${voice.provider})`);
      return true;
    } catch (error: any) {
      this.logger.error(`Voice verification failed: ${error.message}`);
      if (error.status === 404 || error.statusCode === 404) {
        this.logger.error(`Voice ID "${voiceId}" does not exist in your Retell account`);
      }
      return false;
    }
  }

  /**
   * List all available voices in the Retell account
   * @returns Array of available voices with display names
   */
  async listAvailableVoices(): Promise<Array<{ 
    voice_id: string; 
    voice_name: string; 
    provider: string;
    display_name: string; // Format: "Provider - VoiceName" for frontend display
    isAustralian?: boolean; // Flag to indicate Australian voice
  }>> {
    if (!this.apiKey) {
      this.logger.warn("Cannot list voices: RETELL_API_KEY not configured");
      return [];
    }

    try {
      this.logger.log("Fetching available voices from Retell...");
      const voices = await this.client.voice.list();
      this.logger.log(`Found ${voices.length} available voices`);
      
      // Map provider names to display format (capitalize first letter of each word)
      const providerDisplayMap: Record<string, string> = {
        'elevenlabs': 'ElevenLabs',
        'openai': 'OpenAI',
        'deepgram': 'Deepgram',
        'cartesia': 'Cartesia',
        'minimax': 'Minimax',
      };
      
      // Helper function to check if a voice is Australian
      // Checks for various patterns: "australian", "australia", "au", "en-au", "english (australia)", etc.
      const isAustralianVoice = (voiceName: string, voiceId: string, voice?: any): boolean => {
        const searchText = `${voiceName} ${voiceId}`.toLowerCase();
        
        // Check voice name and ID for Australian indicators
        const hasAustralianIndicator = 
          searchText.includes('australian') || 
          searchText.includes('australia') || 
          searchText.includes('au-') ||
          searchText.includes('_au') ||
          searchText.includes('au_') ||
          searchText.includes('en-au') ||
          searchText.includes('en_au') ||
          searchText.includes('en-australia') ||
          searchText.includes('en_australia') ||
          (searchText.includes('english') && (searchText.includes('australia') || searchText.includes('au')));
        
        // Also check if voice object has language/locale properties
        if (voice) {
          const language = ((voice as any).language || (voice as any).locale || '').toLowerCase();
          if (language.includes('en-au') || language.includes('en_australia') || language === 'en-au') {
            return true;
          }
        }
        
        return hasAustralianIndicator;
      };
      
      const mappedVoices = voices.map(v => {
        // Get display name from map, or capitalize provider name
        const providerDisplay = providerDisplayMap[v.provider] || 
          v.provider.charAt(0).toUpperCase() + v.provider.slice(1);
        
        const isAU = isAustralianVoice(v.voice_name, v.voice_id, v);
        
        return {
          voice_id: v.voice_id,
          voice_name: v.voice_name,
          provider: v.provider,
          display_name: `${providerDisplay} - ${v.voice_name}`,
          isAustralian: isAU,
        };
      });
      
      // Sort: Australian voices first, then others
      const sortedVoices = mappedVoices.sort((a, b) => {
        if (a.isAustralian && !b.isAustralian) return -1;
        if (!a.isAustralian && b.isAustralian) return 1;
        return 0;
      });
      
      const australianVoices = sortedVoices.filter(v => v.isAustralian);
      this.logger.log(`Found ${australianVoices.length} Australian voices out of ${sortedVoices.length} total`);
      
      // Log sample voices for debugging
      if (voices.length > 0) {
        this.logger.log(`Sample voice data (first 3): ${JSON.stringify(voices.slice(0, 3).map(v => ({ 
          name: v.voice_name, 
          id: v.voice_id, 
          provider: v.provider,
          language: (v as any).language,
          locale: (v as any).locale 
        })))}`);
        
        if (australianVoices.length > 0) {
          this.logger.log(`Australian voices found: ${australianVoices.map(v => v.display_name).join(', ')}`);
        } else {
          this.logger.warn(`No Australian voices detected. Sample voice names: ${voices.slice(0, 5).map(v => v.voice_name).join(', ')}`);
        }
      }
      
      return sortedVoices;
    } catch (error: any) {
      this.logger.error(`Failed to list voices: ${error.message}`);
      return [];
    }
  }

  /**
   * Create an agent in Retell AI using the Retell SDK
   * Reference: https://docs.retellai.com/api-references/create-agent
   * @param config Agent configuration
   * @returns Retell agent ID and details
   */
  async createAgent(config: AgentCreateParams): Promise<AgentResponse> {
    if (!this.apiKey) {
      throw new HttpException(
        "RETELL_API_KEY is not configured. Please set RETELL_API_KEY environment variable.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log(`Creating Retell agent: ${config.agent_name || "Unnamed"}`);
      this.logger.debug(`Agent config: ${JSON.stringify(config, null, 2)}`);

      // Validate required fields
      if (!config.response_engine || 
          (config.response_engine.type === "retell-llm" && !(config.response_engine as any).llm_id)) {
        throw new HttpException(
          "LLM ID is required in response_engine.llm_id",
          HttpStatus.BAD_REQUEST
        );
      }

      if (!config.voice_id) {
        throw new HttpException(
          "voice_id is required",
          HttpStatus.BAD_REQUEST
        );
      }

      const llmId = (config.response_engine as any).llm_id;
      this.logger.log(`Creating agent with LLM ID: ${llmId}, Voice ID: ${config.voice_id}`);

      // Verify LLM exists before creating agent
      const llmExists = await this.verifyLlmExists(llmId);
      if (!llmExists) {
        throw new HttpException(
          `LLM ${llmId} does not exist or is not accessible. Please verify the LLM was created successfully.`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Verify voice ID exists before creating agent
      const voiceExists = await this.verifyVoiceExists(config.voice_id);
      if (!voiceExists) {
        // List available voices to help user choose a valid one
        const availableVoices = await this.listAvailableVoices();
        const voiceList = availableVoices.length > 0 
          ? `\nAvailable voices in your account:\n${availableVoices.map(v => `  - ${v.voice_id} (${v.voice_name} from ${v.provider})`).join('\n')}`
          : '\nCould not fetch available voices. Please check your Retell dashboard.';
        
        throw new HttpException(
          `Voice ID "${config.voice_id}" does not exist in your Retell account.${voiceList}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Use Retell SDK to create agent
      // According to Retell API docs: https://docs.retellai.com/api-references/create-agent
      // The structure should be: { response_engine: { llm_id: '...', type: 'retell-llm' }, voice_id: '...' }

      this.logger.log(`Creating agent with config: ${JSON.stringify(config, null, 2)}`);
      
      // Log the exact structure being sent
      this.logger.log(`Request structure check:`);
      this.logger.log(`  - response_engine.type: ${(config.response_engine as any)?.type}`);
      this.logger.log(`  - response_engine.llm_id: ${(config.response_engine as any)?.llm_id}`);
      this.logger.log(`  - voice_id: ${config.voice_id}`);
      this.logger.log(`  - agent_name: ${config.agent_name}`);
      this.logger.log(`  - language: ${config.language}`);
      
      // Try to create the agent
      this.logger.log(`Calling Retell SDK agent.create()...`);
      const agentResponse = await this.client.agent.create(config);

      this.logger.log(`Retell agent created successfully: ${agentResponse.agent_id}`);
      return agentResponse;
    } catch (error: any) {
      this.logger.error(
        `Error creating Retell agent: ${error.message}`,
        error.stack
      );
      this.logger.error(`Failed config: ${JSON.stringify(config, null, 2)}`);

      // Log the full error object to see all available properties
      this.logger.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);

      // Log more details about the error
      if (error.response) {
        this.logger.error(`Retell API response: ${JSON.stringify(error.response, null, 2)}`);
      }
      if (error.body) {
        this.logger.error(`Retell API error body: ${JSON.stringify(error.body, null, 2)}`);
      }
      if (error.data) {
        this.logger.error(`Retell API error data: ${JSON.stringify(error.data, null, 2)}`);
      }
      if (error.status || error.statusCode) {
        this.logger.error(`HTTP Status: ${error.status || error.statusCode}`);
      }
      
      // Log request details if available
      if (error.request) {
        this.logger.error(`Request details: ${JSON.stringify(error.request, null, 2)}`);
      }
      
      // If 404, provide more specific guidance with missing fields
      if (error.status === 404 || error.statusCode === 404) {
        const llmId = (config.response_engine as any)?.llm_id;
        const missingFields: string[] = [];
        
        // Check for missing required fields
        if (!llmId) {
          missingFields.push("LLM ID (response_engine.llm_id)");
        }
        if (!config.voice_id) {
          missingFields.push("Voice ID (voice_id)");
        }
        if (!config.agent_name) {
          missingFields.push("Agent Name (agent_name)");
        }
        if (!config.language) {
          missingFields.push("Language (language)");
        }
        if (!config.response_engine || !(config.response_engine as any)?.type) {
          missingFields.push("Response Engine Type (response_engine.type)");
        }
        
        // Verify LLM exists
        let llmVerified = false;
        if (llmId) {
          try {
            llmVerified = await this.verifyLlmExists(llmId);
            if (!llmVerified) {
              missingFields.push(`LLM ID "${llmId}" does not exist in your Retell account`);
            }
          } catch (verifyError) {
            this.logger.error(`Could not verify LLM: ${verifyError}`);
            missingFields.push(`LLM ID "${llmId}" verification failed`);
          }
        }
        
        // Verify voice exists
        let voiceVerified = false;
        let availableVoices: Array<{ voice_id: string; voice_name: string; provider: string }> = [];
        if (config.voice_id) {
          try {
            voiceVerified = await this.verifyVoiceExists(config.voice_id);
            if (!voiceVerified) {
              missingFields.push(`Voice ID "${config.voice_id}" does not exist in your Retell account`);
              // If voice doesn't exist, list available voices
              availableVoices = await this.listAvailableVoices();
            }
          } catch (verifyError) {
            this.logger.error(`Could not verify voice: ${verifyError}`);
            missingFields.push(`Voice ID "${config.voice_id}" verification failed`);
          }
        }
        
        // Build detailed error message
        let errorMessage = "Failed to create agent in Retell (404 Not Found).\n\n";
        
        if (missingFields.length > 0) {
          errorMessage += "Missing or Invalid Fields:\n";
          missingFields.forEach((field, index) => {
            errorMessage += `${index + 1}. ${field}\n`;
          });
          errorMessage += "\n";
        }
        
        // Add available voices if voice doesn't exist
        if (!voiceVerified && availableVoices.length > 0) {
          errorMessage += "Available voices in your Retell account:\n";
          availableVoices.slice(0, 10).forEach(v => {
            errorMessage += `  - ${v.voice_id} (${v.voice_name} from ${v.provider})\n`;
          });
          if (availableVoices.length > 10) {
            errorMessage += `  ... and ${availableVoices.length - 10} more\n`;
          }
          errorMessage += "\n";
        }
        
        errorMessage += "Please check the Retell API documentation: https://docs.retellai.com/api-references/create-agent";
        
        this.logger.error(errorMessage);
        
        // Throw with detailed error message
        throw new HttpException(
          errorMessage,
          HttpStatus.BAD_REQUEST
        );
      }

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
   * Map display name (e.g., "ElevenLabs - Aria") to Retell voice_id
   * @param displayName The display name from frontend
   * @returns The Retell voice_id
   */
  async mapDisplayNameToVoiceId(displayName: string): Promise<string> {
    try {
      const voices = await this.listAvailableVoices();
      const voice = voices.find(v => v.display_name === displayName);
      
      if (voice) {
        this.logger.log(`Mapped display name "${displayName}" to voice_id "${voice.voice_id}"`);
        return voice.voice_id;
      }
      
      // Fallback to old mapping if not found
      this.logger.warn(`Display name "${displayName}" not found in Retell voices, using fallback mapping`);
      return this.mapGenericVoiceToRetellId(displayName);
    } catch (error) {
      this.logger.error(`Failed to map display name to voice_id: ${error.message}`);
      // Fallback to old mapping
      return this.mapGenericVoiceToRetellId(displayName);
    }
  }

  /**
   * Convert our agent DTO to Retell agent configuration
   * Based on Retell API documentation: https://docs.retellai.com/api-references/create-agent
   * Simplified to only include essential fields for cleaner request body
   * @param createAgentDto Agent DTO from frontend
   * @param llmId The Retell LLM ID to use (created dynamically)
   * @returns Retell agent configuration
   */
  async convertToRetellConfig(createAgentDto: any, llmId: string): Promise<AgentCreateParams> {
    if (!llmId) {
      throw new HttpException(
        "LLM ID is required. Please create a Retell LLM first.",
        HttpStatus.BAD_REQUEST
      );
    }

    // Essential fields only - clean and simple
    const config: AgentCreateParams = {
      response_engine: {
        type: "retell-llm",
        llm_id: llmId,
      },
      voice_id: "", // Will be set below
      agent_name: createAgentDto.name || null,
      language: createAgentDto.language || "en-US",
    };

    // Map voice_id from voice configuration
    if (createAgentDto.voice) {
      if (createAgentDto.voice.type === "custom" && createAgentDto.voice.customVoiceId) {
        config.voice_id = createAgentDto.voice.customVoiceId;
      } else if (createAgentDto.voice.type === "generic" && createAgentDto.voice.genericVoice) {
        // The genericVoice now contains the display_name (e.g., "ElevenLabs - Aria")
        // We need to look up the actual voice_id from Retell
        config.voice_id = await this.mapDisplayNameToVoiceId(createAgentDto.voice.genericVoice);
      }

      // Voice settings (if provided)
      if (createAgentDto.voice.temperature !== undefined) {
        config.voice_temperature = Math.max(0, Math.min(2, createAgentDto.voice.temperature));
      }
      if (createAgentDto.voice.speed !== undefined) {
        config.voice_speed = Math.max(0.5, Math.min(2, createAgentDto.voice.speed));
      }
      if (createAgentDto.voice.volume !== undefined) {
        config.volume = Math.max(0, Math.min(2, createAgentDto.voice.volume));
      }
    }

    // If no voice_id is set, try to find an Australian voice as default
    if (!config.voice_id) {
      try {
        const voices = await this.listAvailableVoices();
        const australianVoice = voices.find(v => v.isAustralian);
        if (australianVoice) {
          config.voice_id = australianVoice.voice_id;
          this.logger.log(`No voice_id specified, using Australian voice: ${australianVoice.display_name} (${australianVoice.voice_id})`);
        } else if (voices.length > 0) {
          config.voice_id = voices[0].voice_id;
          this.logger.warn(`No voice_id specified and no Australian voice found, using first available: ${voices[0].display_name} (${voices[0].voice_id})`);
        } else {
          config.voice_id = "11labs-Adrian";
          this.logger.warn("No voice_id specified and no voices available, using fallback: 11labs-Adrian");
        }
      } catch (error) {
        config.voice_id = "11labs-Adrian";
        this.logger.warn("No voice_id specified and failed to fetch voices, using fallback: 11labs-Adrian");
      }
    }

    // Only include webhook if explicitly provided
    if (createAgentDto.notifications?.crm?.endpoint) {
      config.webhook_url = createAgentDto.notifications.crm.endpoint;
    }

    // Only include voicemail if explicitly enabled
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
    }

    // Agent behavior settings
    if (createAgentDto.responsiveness !== undefined) {
      config.responsiveness = Math.max(0, Math.min(1, createAgentDto.responsiveness));
    }
    if (createAgentDto.interruptionSensitivity !== undefined) {
      config.interruption_sensitivity = Math.max(0, Math.min(1, createAgentDto.interruptionSensitivity));
    }

    // Call management settings
    if (createAgentDto.endCallAfterSilenceMs !== undefined) {
      config.end_call_after_silence_ms = Math.max(10000, createAgentDto.endCallAfterSilenceMs);
    }
    if (createAgentDto.maxCallDurationMs !== undefined) {
      config.max_call_duration_ms = Math.max(60000, Math.min(7200000, createAgentDto.maxCallDurationMs));
    }
    if (createAgentDto.beginMessageDelayMs !== undefined) {
      config.begin_message_delay_ms = Math.max(0, Math.min(5000, createAgentDto.beginMessageDelayMs));
    }

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

  /**
   * Register a phone call with Retell for custom telephony integration (Twilio)
   * This creates a call session that can be connected via SIP
   * @param agentId Retell agent ID
   * @param fromNumber Caller's phone number (optional, for tracking)
   * @param toNumber Called number (optional, for tracking)
   * @returns Retell call response with call_id and connection details
   */
  async registerPhoneCall(
    agentId: string,
    fromNumber?: string,
    toNumber?: string
  ): Promise<any> {
    if (!this.apiKey) {
      throw new HttpException(
        "RETELL_API_KEY is not configured.",
        HttpStatus.UNAUTHORIZED
      );
    }

    if (!agentId) {
      throw new HttpException(
        "Agent ID is required to register a phone call.",
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      this.logger.log(
        `Registering phone call with Retell for agent ${agentId}`
      );

      const params: any = {
        agent_id: agentId,
        direction: "inbound" as const,
      };

      if (fromNumber) {
        params.from_number = fromNumber;
      }

      if (toNumber) {
        params.to_number = toNumber;
      }

      const response = await this.client.call.registerPhoneCall(params);

      this.logger.log(
        `Successfully registered phone call with Retell. Call ID: ${response.call_id}`
      );

      return response;
    } catch (error: any) {
      this.logger.error(
        `Error registering phone call with Retell: ${error.message}`,
        error.stack
      );

      if (error.response) {
        this.logger.error(
          `Retell API error response: ${JSON.stringify(error.response, null, 2)}`
        );
      }

      throw new HttpException(
        `Failed to register phone call with Retell: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Upload a custom voice to Retell
   * @param filePath Path to the voice file
   * @param voiceName Name for the voice
   * @param fileBuffer Optional file buffer (if file is already in memory)
   * @returns Retell voice ID
   */
  async uploadCustomVoice(
    filePath: string,
    voiceName: string,
    fileBuffer?: Buffer
  ): Promise<string> {
    if (!this.apiKey) {
      throw new HttpException(
        "RETELL_API_KEY is not configured. Please set RETELL_API_KEY environment variable.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log(`Uploading custom voice to Retell: ${voiceName}`);

      // Read file if buffer not provided
      let buffer = fileBuffer;
      if (!buffer) {
        const { readFile } = await import("fs/promises");
        buffer = await readFile(filePath);
      }

      // Retell API endpoint for voice upload
      // According to Retell docs, we need to use their REST API directly
      // POST https://api.retellai.com/create-voice
      const FormData = require("form-data");
      const formData = new FormData();
      // Determine content type from file extension
      const fileName = filePath.split(/[/\\]/).pop() || "voice.mp3";
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'mp3';
      const contentType = fileExt === 'webm' ? 'audio/webm' : 
                         fileExt === 'wav' ? 'audio/wav' : 
                         fileExt === 'm4a' ? 'audio/m4a' : 
                         'audio/mpeg';
      
      formData.append("file", buffer, {
        filename: fileName,
        contentType: contentType,
      });
      formData.append("name", voiceName);

      const response = await fetch("https://api.retellai.com/create-voice", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Retell voice upload failed: ${response.status} ${errorText}`);
        throw new HttpException(
          `Failed to upload voice to Retell: ${response.statusText}`,
          response.status
        );
      }

      const result = await response.json();
      const voiceId = result.voice_id || result.id;

      if (!voiceId) {
        this.logger.error(`Retell voice upload response missing voice_id:`, result);
        throw new HttpException(
          "Retell voice upload succeeded but no voice_id returned",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      this.logger.log(`Custom voice uploaded to Retell. Voice ID: ${voiceId}`);
      return voiceId;
    } catch (error: any) {
      this.logger.error(
        `Error uploading voice to Retell: ${error.message}`,
        error.stack
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to upload voice to Retell: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

