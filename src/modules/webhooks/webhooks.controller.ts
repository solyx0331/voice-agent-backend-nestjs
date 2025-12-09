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

      // Process the webhook
      await this.webhooksService.handleTwilioWebhook(agentId, body);

      // Return TwiML response for Twilio
      // Twilio expects a TwiML XML response for voice calls
      const twiml = this.webhooksService.generateTwiMLResponse(agentId);
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
  <Say>Sorry, there was an error processing your call.</Say>
  <Hangup/>
</Response>`;
      res.type("text/xml");
      return res.status(HttpStatus.OK).send(errorTwiml);
    }
  }
}

