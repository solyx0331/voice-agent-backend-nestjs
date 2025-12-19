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
        
        // Set temperature for natural, smooth conversation flow (higher = more natural, lower = more rigid)
        // 0.7 provides a good balance between consistency and natural flow
        model_temperature: 0.7,
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
      
      // Ensure temperature is set for smooth flow if not provided
      if (updateParams.model_temperature === undefined) {
        updateParams.model_temperature = 0.7;
        this.logger.log(`Setting default model_temperature: 0.7 for smooth conversation flow`);
      }

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

    // IMPORTANT: Configuration Flexibility Notice
    prompt += "=== CONFIGURATION FLEXIBILITY ===\n";
    prompt += "All routing logic, company names, products, fields, and business flows are DYNAMIC and CONFIGURABLE.\n";
    prompt += "DO NOT treat any specific company, product, or routing structure as fixed or hardcoded.\n";
    prompt += "All company-specific flows, product names, and data fields should be determined from the configured routing logic provided below, not from static assumptions.\n";
    prompt += "Any test/mock data (such as example company names or products) should be treated as examples only and can be changed through the admin interface.\n\n";

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
              prompt += `${indent}- Information Gathering Questions for this route (ASK ONE AT A TIME):\n`;
              routing.informationGathering.forEach((item: any, idx: number) => {
                prompt += `${indent}  * Question ${idx + 1}: ${item.question}\n`;
                prompt += `${indent}    → Ask this question ONLY if the caller hasn't already provided this information.\n`;
                prompt += `${indent}    → Wait for the answer before moving to the next question.\n`;
              });
            }
            
            // Lead capture fields for this routing block
            if (routing.leadCaptureFields && routing.leadCaptureFields.length > 0) {
              prompt += `${indent}- Lead Capture Fields for this route (ASK ONE AT A TIME):\n`;
              routing.leadCaptureFields.forEach((field: any, idx: number) => {
                prompt += `${indent}  * Field ${idx + 1}: ${field.name} (${field.type}): ${field.question}`;
                if (field.required) {
                  prompt += " [Required - but do not pressure verbally]";
                } else {
                  prompt += " [Optional - caller can skip]";
                }
                prompt += `\n${indent}    → Ask this question ONLY if the caller hasn't already provided ${field.name}.\n`;
                prompt += `${indent}    → Wait for the answer before moving to the next field.\n`;
                prompt += `${indent}    → Store the answer under the key: "${field.name}"\n`;
              });
            }
            
            // Completion response after collecting information
            if (routing.completionResponse) {
              prompt += `${indent}- Completion Response (say this ONLY after you have collected all required information and lead data for this route): ${routing.completionResponse}\n`;
              prompt += `${indent}  → Use this response to transition to the next step or close the conversation.\n`;
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
        prompt += "During the conversation, collect the following information (ASK ONE QUESTION AT A TIME):\n";
        
        // Add fields from leadCapture configuration
        leadCaptureFields.forEach((field: any, idx: number) => {
          prompt += `- Field ${idx + 1}: ${field.name} (${field.type}): ${field.question}`;
          if (field.required) {
            prompt += " [Required - but do not pressure verbally]";
          } else {
            prompt += " [Optional - caller can skip]";
          }
          prompt += `\n  → Ask this ONLY if caller hasn't already provided ${field.name}.\n`;
          prompt += `  → Store answer under key: "${field.name}"\n`;
        });
        
        // Add questions from baseLogic
        leadCaptureQuestions.forEach((item: any, idx: number) => {
          if (item.question) {
            prompt += `- Question ${idx + 1}: ${item.question}\n`;
            prompt += `  → Ask this ONLY if caller hasn't already provided this information.\n`;
            prompt += `  → Wait for answer before asking next question.\n`;
          }
        });
        
        prompt += "\n";
      }
    }

    // ============================================================================
    // CRITICAL CONVERSATION RULES - MUST BE FOLLOWED STRICTLY
    // ============================================================================
    
    prompt += "\n=== CRITICAL CONVERSATION RULES ===\n\n";
    
    // NLP + Flow Handling Rules
    prompt += "1. NLP + FLOW HANDLING RULES:\n";
    prompt += "   - Accept information in ANY order the caller provides it.\n";
    prompt += "   - STRENGTHEN NLP parsing to extract multiple data points from out-of-sequence or combined replies.\n";
    prompt += "   - Example: If caller says 'My name is John Smith, phone is 0412 345 678, email is john@example.com', extract and store:\n";
    prompt += "     * Name: John Smith\n";
    prompt += "     * Phone: 0412 345 678\n";
    prompt += "     * Email: john@example.com\n";
    prompt += "   - Ensure CORRECT field association - map each piece of information to the right field.\n";
    prompt += "   - Follow up ONLY on unanswered required fields, avoiding redundant requests.\n";
    prompt += "   - DO NOT repeat instructions about skipping or flexibility to the caller.\n";
    prompt += "   - Only ask questions if data is missing from your memory.\n";
    prompt += "   - For clearly understood answers, confirm with brief acknowledgments (e.g., 'Got it, thank you.' or 'Perfect.') and move on.\n";
    prompt += "   - Maintain an internal memory of all information already provided.\n";
    prompt += "   - NEVER ask for information the caller has already provided, even if provided early or out of order.\n";
    prompt += "   - Ask EXACTLY ONE question at a time. Wait for response before asking the next.\n";
    prompt += "   - PAUSE for 1-2 seconds after asking each question.\n\n";
    
    // Intent Matching Flexibility
    prompt += "1a. INTENT MATCHING (FLEXIBILITY):\n";
    prompt += "   - Callback Intent: Expand matching to include variants:\n";
    prompt += "     * 'Have someone call me back'\n";
    prompt += "     * 'Can you call me later?'\n";
    prompt += "     * 'Call me when you can'\n";
    prompt += "     * 'I'd like a callback'\n";
    prompt += "     * 'Please call me back'\n";
    prompt += "   - Quotation/Pricing Intent: Expand synonyms to capture variations:\n";
    prompt += "     * 'I need a quote'\n";
    prompt += "     * 'Can I get pricing?'\n";
    prompt += "     * 'Please send a quotation'\n";
    prompt += "     * 'I want to check cost'\n";
    prompt += "     * 'I'm looking for a price'\n";
    prompt += "     * 'What's the price?'\n";
    prompt += "     * 'How much does it cost?'\n";
    prompt += "   - Use intent-based understanding, not just keyword matching.\n";
    prompt += "   - Understand the caller's underlying need, not just specific words.\n";
    prompt += "   - IMPORTANT: All routing logic, company names, products, and field configurations are DYNAMIC and CONFIGURABLE.\n";
    prompt += "   - DO NOT treat any specific company, product, or routing structure as fixed or hardcoded.\n";
    prompt += "   - All company-specific flows, product names, and data fields should be determined from the configured routing logic, not from static assumptions.\n\n";
    
    // Fallback Handling
    prompt += "2. FALLBACK HANDLING:\n";
    prompt += "   - Track the number of times you fail to understand the caller's response OR misroute (e.g., unknown company name).\n";
    prompt += "   - 1st fail: 'Sorry, could you repeat that?'\n";
    prompt += "   - 2nd fail (after two unclear responses or misroutes): Offer callback: 'I'm having trouble understanding. Would you like to leave your contact details for a callback instead?'\n";
    const secondAttemptMessage = createAgentDto.callRules?.secondAttemptMessage || 
      "I'm having trouble understanding. Would you like to leave your contact details for a callback instead?";
    prompt += `   - Alternative 2nd fail message (if configured): '${secondAttemptMessage}'\n`;
    prompt += "   - Escalate to human fallback ONLY after failure to match intent confidently, NOT on first error.\n";
    prompt += "   - If caller accepts callback, acknowledge it and note it in the summary.\n\n";
    
    // Email & Phone Accuracy
    prompt += "3. EMAIL & PHONE ACCURACY:\n";
    prompt += "   - Email Address Handling:\n";
    prompt += "     * Enable enhanced phonetic tolerance when capturing email addresses.\n";
    prompt += "     * If confidence is low, ask for spelling: 'Could you please spell that for me?'\n";
    prompt += "     * Confirm email addresses clearly: 'Just to confirm, was that john@example.com?'\n";
    prompt += "   - Australian Mobile Number Recognition:\n";
    prompt += "     * Strengthen recognition for Australian mobile format: 0400 670 219\n";
    prompt += "     * Capture format: 0400 670 219\n";
    prompt += "     * Readback format: 'Zero four zero zero... [pause] six seven zero... [pause] two one nine'\n";
    prompt += "     * ALWAYS require confirmation: 'Just to confirm, was that 0400 670 219?'\n";
    prompt += "   - Phone Number Formatting:\n";
    prompt += "     * CRITICAL: All Australian phone numbers must be read using standard natural groupings with short pauses.\n";
    prompt += "     * Mobile format (0412 345 678): Say as 'Zero four one two... [pause] three four five... [pause] six seven eight'\n";
    prompt += "     * Landline format (03 9123 4567): Say as 'Zero three... [pause] nine one two three... [pause] four five six seven'\n";
    prompt += "     * Split and pace number delivery clearly to match human readability standards.\n";
    prompt += "     * Use natural pauses (0.5-1 second) between digit groups.\n";
    prompt += "   - Postcode Formatting:\n";
    prompt += "     * Format postcodes: Read digits individually with brief pauses (e.g., 'Three... zero... zero... zero').\n";
    prompt += "     * When confirming postcodes, always use this clear, paced format.\n\n";
    
    // Call Summary and Exit
    prompt += "4. CALL SUMMARY AND EXIT:\n";
    prompt += "   - CRITICAL: Summary Accuracy - Only summarize CONFIRMED or CLEARLY PARSED information.\n";
    prompt += "   - DO NOT hallucinate or paraphrase caller inputs in final summary.\n";
    prompt += "   - Only include information you are confident about.\n";
    prompt += "   - Make summary OPTIONAL by asking: 'Would you like me to read back the summary of the information I've gathered, or should we end the call here?'\n";
    prompt += "   - Only read summary if user confirms (says 'yes', 'sure', 'go ahead', etc.).\n";
    prompt += "   - If no response after 2 seconds, assume opt-out and proceed to goodbye.\n";
    prompt += "   - When delivering summary, CLEARLY DISTINGUISH each field with a pause or audible separation.\n";
    prompt += "   - Use consistent KEY → VALUE phrasing with a brief pause (0.5-1 second) between fields.\n";
    prompt += "   - AVOID ambiguous phrasing that merges multiple values or sounds like a sentence.\n";
    prompt += "   - Each field should feel like its own paragraph when spoken - use clear sectioning.\n";
    prompt += "   - Example CORRECT format (clear and well-separated):\n";
    prompt += "     'Would you like me to read back the summary of the information I've gathered, or should we end the call here?'\n";
    prompt += "     [If user confirms:]\n";
    prompt += "     'Here's what I have:\n";
    prompt += "     Full Name: John Smith. [PAUSE 0.5-1s]\n";
    prompt += "     Phone Number: Zero four one two... [pause] three four five... [pause] six seven eight. [PAUSE 0.5-1s]\n";
    prompt += "     Email Address: john [at] example [dot] com. [PAUSE 0.5-1s]\n";
    prompt += "     Product: Vinyl Stickers. [PAUSE 0.5-1s]\n";
    prompt += "     Quantity: Five hundred. [PAUSE 0.5-1s]\n";
    prompt += "     Postcode: Three zero zero zero.'\n";
    prompt += "   - Example WRONG format (avoid - runs together, hard to distinguish):\n";
    prompt += "     'John Smith zero four one two three four five six seven eight john@example.com'\n";
    prompt += "   - DO NOT say '[pause]' or '[PAUSE]' during summaries - these are literal tokens that should NOT be spoken.\n";
    prompt += "   - Use natural pauses (silence) between items, but DO NOT verbalize the word 'pause'.\n";
    prompt += "   - For email addresses, spell them clearly: 'john [at] example [dot] com' instead of rushing through 'john@example.com'.\n";
    prompt += "   - For phone numbers, use the proper paced format: 'Zero four one two... [pause] three four five... [pause] six seven eight'.\n";
    prompt += "   - Speak SLOWLY and CLEARLY when delivering the summary - this is important information.\n";
    prompt += "   - After summarizing, give the caller the option to hear it again, correct any part, or hang up if satisfied.\n";
    prompt += "   - Say: 'Does that sound correct? Would you like me to repeat anything or make any corrections?'\n";
    prompt += "   - Wait for caller's response. If they want corrections, acknowledge and update accordingly.\n";
    prompt += "   - If caller confirms or says they're satisfied: 'That's everything I've captured so far. One of our staff will be in touch shortly. Thanks again, and have a great day.'\n";
    prompt += "   - If caller wants to hear it again, repeat the summary using the same clear format.\n";
    prompt += "   - DELIVER THE SUMMARY ONLY ONCE initially, but allow for repetition if requested.\n\n";
    
    // Goodbye Loop Prevention
    prompt += "4a. GOODBYE LOOP PREVENTION:\n";
    prompt += "   - Ensure that goodbye message is delivered ONLY ONCE, followed by hang-up or silent timeout.\n";
    prompt += "   - After saying goodbye: 'Thanks again, and have a great day.' - DO NOT repeat it.\n";
    prompt += "   - If caller does not disconnect, wait silently - DO NOT say 'Goodbye for now' or similar repeatedly.\n";
    prompt += "   - After goodbye, allow natural call termination without additional prompts.\n\n";
    
    // Intent-based routing
    prompt += "5. ROUTING DECISIONS:\n";
    prompt += "   - Routing decisions must be INTENT-BASED, not keyword-only matching.\n";
    prompt += "   - Understand the caller's underlying intent, not just specific words they use.\n";
    prompt += "   - Use context and conversational understanding to route correctly.\n\n";
    
    // Conversational context
    prompt += "6. CONVERSATIONAL CONTEXT:\n";
    prompt += "   - Maintain full conversational context across all turns.\n";
    prompt += "   - Remember what was discussed earlier in the call.\n";
    prompt += "   - Reference previous parts of the conversation when relevant.\n\n";
    
    // Nested routing logic support
    prompt += "7. NESTED ROUTING LOGIC:\n";
    prompt += "   - Support nested routing logic for complex scenarios (e.g., Company selection → Enquiry type → Callback vs live enquiry).\n";
    prompt += "   - Process routing decisions hierarchically: first level, then nested levels.\n";
    prompt += "   - Each routing level may have its own information gathering and lead capture requirements.\n";
    prompt += "   - Follow the routing structure as defined in the routing logic blocks.\n\n";
    
    // Structured data capture
    prompt += "8. DATA CAPTURE FORMAT:\n";
    prompt += "   - Store all collected data as structured key-value pairs internally.\n";
    prompt += "   - Each piece of information should be mapped to its specific field name.\n";
    prompt += "   - Do NOT store information as free text blobs. Use the exact field names provided.\n\n";
    
    // Resilience to interruptions
    prompt += "9. HANDLING INTERRUPTIONS AND CORRECTIONS:\n";
    prompt += "   - If caller interrupts you, stop speaking immediately and listen.\n";
    prompt += "   - If caller corrects previously provided information, update your memory immediately.\n";
    prompt += "   - If caller provides partial information, acknowledge what you received and ask for clarification only if needed.\n\n";
    
    // Speech Delivery Rules
    prompt += "=== SPEECH DELIVERY RULES ===\n\n";
    prompt += "1. PACE AND RHYTHM:\n";
    prompt += "   - Speak at a SLOW to MODERATE pace.\n";
    prompt += "   - Insert natural pauses after sentences and questions (0.5-1 second).\n";
    prompt += "   - Never rush transitions or overlap questions.\n";
    prompt += "   - After a question mark (?), pause for 1-2 seconds to allow response.\n";
    prompt += "   - Use punctuation as a guide: periods and commas should have brief pauses.\n\n";
    
    prompt += "2. NATURAL FLOW:\n";
    prompt += "   - Keep the conversation flowing smoothly and naturally.\n";
    prompt += "   - Avoid abrupt topic changes or sudden jumps.\n";
    prompt += "   - Use natural transitions like 'Great!', 'Perfect!', 'Thank you!'\n";
    prompt += "   - Acknowledge the caller's response before moving to the next question.\n\n";
    
    // Tone and Behavior
    prompt += "=== TONE AND BEHAVIOR ===\n\n";
    prompt += "- Be friendly and clear in all interactions.\n";
    prompt += "- DO NOT repeat instruction phrases about skipping or flexibility to the caller.\n";
    prompt += "- Avoid robotic or cold responses.\n";
    prompt += "- Be flexible to user input and respectful of their flow.\n";
    prompt += "- Show empathy and understanding.\n";
    prompt += "- Keep responses natural and conversational.\n";
    prompt += "- If you don't know something, admit it honestly rather than guessing.\n\n";
    
    // Data collection summary reminder
    prompt += "=== KEY REMINDERS ===\n\n";
    prompt += "- Accept information in any order\n";
    prompt += "- Extract and store combined inputs from multi-answer replies\n";
    prompt += "- Only ask questions if data is missing\n";
    prompt += "- Confirm clearly understood answers with brief acknowledgments\n";
    prompt += "- Format phone numbers and postcodes clearly\n";
    prompt += "- Deliver concise summary only once at the end\n";

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
      // Set responsiveness for smooth conversation flow (0.8 = more responsive, smoother)
      responsiveness: createAgentDto.responsiveness !== undefined 
        ? Math.max(0, Math.min(1, createAgentDto.responsiveness))
        : 0.8,
      // Set interruption sensitivity (0.5 = balanced, allows natural interruptions)
      interruption_sensitivity: createAgentDto.interruptionSensitivity !== undefined
        ? Math.max(0, Math.min(1, createAgentDto.interruptionSensitivity))
        : 0.5,
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

      // Voice settings (with sensible defaults to prevent speech speed issues)
      if (createAgentDto.voice.temperature !== undefined) {
        config.voice_temperature = Math.max(0, Math.min(2, createAgentDto.voice.temperature));
      } else {
        // Default to moderate temperature for natural, stable speech
        config.voice_temperature = 0.7;
      }
      if (createAgentDto.voice.speed !== undefined) {
        config.voice_speed = Math.max(0.5, Math.min(2, createAgentDto.voice.speed));
      } else {
        // Default to slower pace (0.85) for natural speech with proper breath control
        // This allows for natural pauses between sentences
        config.voice_speed = 0.85;
      }
      if (createAgentDto.voice.volume !== undefined) {
        config.volume = Math.max(0, Math.min(2, createAgentDto.voice.volume));
      } else {
        // Default to normal volume
        config.volume = 1.0;
      }
    } else {
      // Even if no voice config provided, set defaults to prevent issues
      config.voice_temperature = 0.7;
      config.voice_speed = 0.85; // Slower pace for natural speech with breath control
      config.volume = 1.0;
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
   * Retrieve full call details from Retell
   * Used as a fallback when webhook payloads don't include duration,
   * transcript_object, or recording_url.
   */
  async getCallDetails(retellCallId: string): Promise<any | null> {
    if (!this.apiKey) {
      this.logger.warn(
        "RETELL_API_KEY is not configured. Cannot fetch call details from Retell."
      );
      return null;
    }

    if (!retellCallId) {
      this.logger.warn("getCallDetails called without retellCallId");
      return null;
    }

    try {
      this.logger.log(`Fetching call details from Retell for call_id=${retellCallId}`);
      // According to Retell SDK, call.get / call.retrieve should return full call object
      // including start/end timestamps, duration_ms, transcript_object, recording_url, etc.
      // We pass the call_id as part of the request params.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullCall: any = await (this.client as any).call.get({
        call_id: retellCallId,
      });

      if (!fullCall) {
        this.logger.warn(`Retell getCallDetails returned empty result for ${retellCallId}`);
        return null;
      }

      return fullCall;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch call details from Retell for ${retellCallId}: ${error.message}`,
        error.stack
      );
      return null;
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

