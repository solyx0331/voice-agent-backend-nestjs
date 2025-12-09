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
   * Retell sends webhooks for call events (started, ended, transcript, analyzed)
   * Configure this URL in Retell dashboard: https://your-backend.com/api/webhooks/retell
   */
  @Post("retell")
  async handleRetellWebhook(@Body() body: any) {
    try {
      this.logger.log(`Received Retell webhook`);
      this.logger.debug(`Retell webhook payload: ${JSON.stringify(body, null, 2)}`);

      // Process the Retell webhook
      await this.webhooksService.handleRetellWebhook(body);

      // Retell webhooks expect a 200 OK response
      return { status: "ok" };
    } catch (error: any) {
      this.logger.error(
        `Error handling Retell webhook: ${error.message}`,
        error.stack
      );
      
      // Still return 200 to Retell to avoid retries for processing errors
      return { status: "error", message: error.message };
    }
  }
}

