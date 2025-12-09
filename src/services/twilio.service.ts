import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import twilio from "twilio";

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: twilio.Twilio;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly webhookBaseUrl: string;
  private readonly staticPhoneNumber: string;

  constructor(private configService: ConfigService) {
    this.accountSid =
      process.env.TWILIO_ACCOUNT_SID ||
      this.configService.get<string>("TWILIO_ACCOUNT_SID") ||
      "";

    this.authToken =
      process.env.TWILIO_AUTH_TOKEN ||
      this.configService.get<string>("TWILIO_AUTH_TOKEN") ||
      "";

    this.webhookBaseUrl =
      process.env.WEBHOOK_BASE_URL ||
      this.configService.get<string>("WEBHOOK_BASE_URL") ||
      "";

    this.staticPhoneNumber =
      process.env.TWILIO_STATIC_PHONE_NUMBER ||
      this.configService.get<string>("TWILIO_STATIC_PHONE_NUMBER") ||
      "";

    if (!this.accountSid || !this.authToken) {
      this.logger.warn(
        "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not found. Twilio integration will not work."
      );
    }

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }

    if (this.staticPhoneNumber) {
      this.logger.log(`Using static Twilio phone number: ${this.staticPhoneNumber}`);
    }
  }

  /**
   * Normalize phone number to E.164 format
   * Removes spaces and ensures proper format
   * @param phoneNumber Phone number (e.g., "+61 3 4151 7921" or "+61341517921")
   * @returns Normalized phone number in E.164 format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all spaces and ensure it starts with +
    return phoneNumber.replace(/\s+/g, "").trim();
  }

  /**
   * Get phone number SID from an existing phone number
   * @param phoneNumber Phone number in E.164 format (e.g., +61341517921 or +61 3 4151 7921)
   * @returns Phone number SID
   */
  async getPhoneNumberSid(phoneNumber: string): Promise<string> {
    if (!this.accountSid || !this.authToken) {
      throw new HttpException(
        "Twilio credentials are not configured.",
        HttpStatus.UNAUTHORIZED
      );
    }

    // Normalize phone number to E.164 format
    const normalizedNumber = this.normalizePhoneNumber(phoneNumber);

    try {
      this.logger.log(`Looking up phone number SID for: ${normalizedNumber}`);
      
      // List all incoming phone numbers and find the one matching our number
      const phoneNumbers = await this.client.incomingPhoneNumbers.list({
        phoneNumber: normalizedNumber,
        limit: 1,
      });

      if (phoneNumbers.length === 0) {
        throw new HttpException(
          `Phone number ${normalizedNumber} not found in your Twilio account. Please ensure the number is purchased and active.`,
          HttpStatus.NOT_FOUND
        );
      }

      const phoneNumberSid = phoneNumbers[0].sid;
      this.logger.log(`Found phone number SID: ${phoneNumberSid} for ${normalizedNumber}`);
      return phoneNumberSid;
    } catch (error: any) {
      this.logger.error(
        `Error looking up phone number SID: ${error.message}`,
        error.stack
      );

      if (error.status === 404 || error.statusCode === 404) {
        throw new HttpException(
          `Phone number ${normalizedNumber} not found in your Twilio account.`,
          HttpStatus.NOT_FOUND
        );
      }

      throw new HttpException(
        `Failed to lookup phone number SID: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get or purchase a phone number for an agent
   * Uses static phone number if configured, otherwise purchases a new one
   * @returns Phone number details
   */
  async getOrPurchasePhoneNumber(): Promise<{
    phoneNumber: string;
    phoneNumberSid: string;
  }> {
    // If static phone number is configured, use it
    if (this.staticPhoneNumber) {
      const normalizedNumber = this.normalizePhoneNumber(this.staticPhoneNumber);
      this.logger.log(`Using static phone number: ${normalizedNumber}`);
      const phoneNumberSid = await this.getPhoneNumberSid(normalizedNumber);
      return {
        phoneNumber: normalizedNumber,
        phoneNumberSid: phoneNumberSid,
      };
    }

    // Otherwise, purchase a new number
    return this.purchaseAustralianNumber();
  }

  /**
   * Purchase an Australian phone number from Twilio
   * @returns Purchased phone number details
   */
  async purchaseAustralianNumber(): Promise<{
    phoneNumber: string;
    phoneNumberSid: string;
  }> {
    if (!this.accountSid || !this.authToken) {
      throw new HttpException(
        "Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log("Searching for available Australian phone numbers...");

      // Search for available Australian mobile numbers
      // Australia country code: AU
      // Mobile capability is required for voice calls
      const availableNumbers = await this.client.availablePhoneNumbers("AU")
        .mobile.list({
          limit: 10,
        });

      if (availableNumbers.length === 0) {
        throw new HttpException(
          "No available Australian phone numbers found. Please try again later or contact Twilio support.",
          HttpStatus.NOT_FOUND
        );
      }

      // Purchase the first available number
      const numberToPurchase = availableNumbers[0];
      this.logger.log(
        `Purchasing phone number: ${numberToPurchase.phoneNumber}`
      );

      const purchasedNumber = await this.client.incomingPhoneNumbers.create({
        phoneNumber: numberToPurchase.phoneNumber,
      });

      this.logger.log(
        `Successfully purchased phone number: ${purchasedNumber.phoneNumber} (SID: ${purchasedNumber.sid})`
      );

      return {
        phoneNumber: purchasedNumber.phoneNumber,
        phoneNumberSid: purchasedNumber.sid,
      };
    } catch (error: any) {
      this.logger.error(
        `Error purchasing Twilio phone number: ${error.message}`,
        error.stack
      );

      if (error.status === 401 || error.statusCode === 401) {
        throw new HttpException(
          "Twilio authentication failed. Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
          HttpStatus.UNAUTHORIZED
        );
      }

      if (error.status === 404 || error.statusCode === 404) {
        throw new HttpException(
          "No available Australian phone numbers found.",
          HttpStatus.NOT_FOUND
        );
      }

      throw new HttpException(
        `Failed to purchase Twilio phone number: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Configure webhook for a Twilio phone number
   * @param phoneNumberSid Twilio Phone Number SID
   * @param agentId Agent ID to include in webhook URL
   * @returns Updated phone number details
   */
  async configureWebhook(
    phoneNumberSid: string,
    agentId: string
  ): Promise<{
    phoneNumber: string;
    webhookUrl: string;
  }> {
    if (!this.accountSid || !this.authToken) {
      throw new HttpException(
        "Twilio credentials are not configured.",
        HttpStatus.UNAUTHORIZED
      );
    }

    if (!this.webhookBaseUrl) {
      throw new HttpException(
        "WEBHOOK_BASE_URL is not configured. Please set WEBHOOK_BASE_URL environment variable.",
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Construct webhook URL with agent ID
      const webhookUrl = `${this.webhookBaseUrl}/api/webhooks/twilio/${agentId}`;

      this.logger.log(
        `Configuring webhook for phone number ${phoneNumberSid}: ${webhookUrl}`
      );

      // Update the phone number with webhook configuration
      const updatedNumber = await this.client.incomingPhoneNumbers(
        phoneNumberSid
      ).update({
        voiceUrl: webhookUrl,
        voiceMethod: "POST",
        statusCallback: webhookUrl,
        statusCallbackMethod: "POST",
      });

      this.logger.log(
        `Successfully configured webhook for phone number: ${updatedNumber.phoneNumber}`
      );

      return {
        phoneNumber: updatedNumber.phoneNumber,
        webhookUrl: webhookUrl,
      };
    } catch (error: any) {
      this.logger.error(
        `Error configuring Twilio webhook: ${error.message}`,
        error.stack
      );

      throw new HttpException(
        `Failed to configure Twilio webhook: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Release a Twilio phone number
   * @param phoneNumberSid Twilio Phone Number SID
   */
  async releasePhoneNumber(phoneNumberSid: string): Promise<void> {
    if (!this.accountSid || !this.authToken) {
      this.logger.warn("Twilio credentials not configured, skipping number release");
      return;
    }

    try {
      this.logger.log(`Releasing Twilio phone number: ${phoneNumberSid}`);
      await this.client.incomingPhoneNumbers(phoneNumberSid).remove();
      this.logger.log(`Successfully released phone number: ${phoneNumberSid}`);
    } catch (error: any) {
      this.logger.error(
        `Error releasing Twilio phone number: ${error.message}`,
        error.stack
      );
      // Don't throw - this is cleanup, so we log but don't fail
    }
  }
}

