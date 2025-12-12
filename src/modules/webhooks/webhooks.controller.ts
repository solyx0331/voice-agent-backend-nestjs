import { Controller, Post, Body, Param, Logger, HttpException, HttpStatus, Res } from "@nestjs/common";
import { Response } from "express";
import { WebhooksService } from "./webhooks.service";

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Handle incoming Twilio webhook for a specific agent
   * This endpoint receives call events from Twilio
   * @param agentId Agent ID from URL parameter
   * @param body Twilio webhook payload
   */
  @Post("twilio/:agentId")
  async handleTwilioWebhook(
    @Param("agentId") agentId: string,
    @Body() body: any,
    @Res() res: Response
  ) {
    try {
      this.logger.log(`Received Twilio webhook for agent ${agentId}`);
      this.logger.debug(`Webhook payload: ${JSON.stringify(body, null, 2)}`);

      // Process the webhook and register call with Retell
      const retellCall = await this.webhooksService.handleTwilioWebhook(agentId, body);

      // Generate TwiML response to connect Twilio call to Retell
      // Only generate connection TwiML if we have a Retell call ID
      const twiml = retellCall.callId
        ? this.webhooksService.generateTwiMLResponse(retellCall.callId, agentId)
        : this.webhooksService.generateTwiMLResponse("", agentId);

      res.type("text/xml");
      return res.send(twiml);
    } catch (error: any) {
      this.logger.error(
        `Error handling Twilio webhook: ${error.message}`,
        error.stack
      );
      
      // Return error TwiML response to Twilio
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, there was an error processing your call. Please try again later.</Say>
  <Hangup/>
</Response>`;
      res.type("text/xml");
      return res.status(HttpStatus.OK).send(errorTwiml);
    }
  }

  /**
   * Handle incoming Retell webhook events
   * Retell sends webhooks for call events (started, ended, transcript, analyzed, function_call)
   * Configure this URL in Retell dashboard: https://your-backend.com/api/webhooks/retell
   * 
   * For function_call events (when LLM generates a response), we:
   * 1. Get the agent's ElevenLabs voice_id
   * 2. Generate TTS audio using ElevenLabs
   * 3. Upload audio to public URL
   * 4. Return play_audio action to Retell
   */
  @Post("retell")
  async handleRetellWebhook(@Body() body: any, @Res() res?: any) {
    try {
      this.logger.log(`Received Retell webhook: ${body.event || "unknown"}`);
      this.logger.debug(`Retell webhook payload: ${JSON.stringify(body, null, 2)}`);

      // Check if this is a function_call event that needs TTS
      if (body.event === "function_call" || body.function_call) {
        const response = await this.webhooksService.handleRetellFunctionCall(body);
        if (response) {
          // Return the play_audio action to Retell
          return res ? res.json(response) : response;
        }
      }

      // Process other Retell webhook events
      await this.webhooksService.handleRetellWebhook(body);

      // Retell webhooks expect a 200 OK response
      return res ? res.json({ status: "ok" }) : { status: "ok" };
    } catch (error: any) {
      this.logger.error(
        `Error handling Retell webhook: ${error.message}`,
        error.stack
      );
      
      // Still return 200 to Retell to avoid retries for processing errors
      return res ? res.json({ status: "error", message: error.message }) : { status: "error", message: error.message };
    }
  }
}

