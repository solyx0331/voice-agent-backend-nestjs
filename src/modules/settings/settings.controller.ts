import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import {
  UpdateProfileDto,
  UpdateVoiceSettingsDto,
  UpdateNotificationSettingsDto,
  ChangePasswordDto,
  Verify2FADto,
  UpdatePaymentMethodDto,
  CreateApiKeyDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from "../../dto/settings.dto";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Put("profile")
  async updateProfile(@Body() data: UpdateProfileDto) {
    return this.settingsService.updateProfile(data);
  }

  @Put("voice")
  async updateVoiceSettings(@Body() data: UpdateVoiceSettingsDto) {
    return this.settingsService.updateVoiceSettings(data);
  }

  @Put("notifications")
  async updateNotificationSettings(@Body() settings: UpdateNotificationSettingsDto) {
    return this.settingsService.updateNotificationSettings(settings);
  }

  @Post("password")
  async changePassword(@Body() data: ChangePasswordDto) {
    return this.settingsService.changePassword(data);
  }

  @Post("2fa/enable")
  async enable2FA() {
    return this.settingsService.enable2FA();
  }

  @Post("2fa/disable")
  async disable2FA() {
    return this.settingsService.disable2FA();
  }

  @Post("2fa/verify")
  async verify2FA(@Body() data: Verify2FADto) {
    return this.settingsService.verify2FA(data);
  }

  @Get("sessions")
  async getActiveSessions() {
    return this.settingsService.getActiveSessions();
  }

  @Delete("sessions/:id")
  async revokeSession(@Param("id") sessionId: string) {
    return this.settingsService.revokeSession(sessionId);
  }

  @Get("billing")
  async getBillingInfo() {
    return this.settingsService.getBillingInfo();
  }

  @Put("billing/payment-method")
  async updatePaymentMethod(@Body() data: UpdatePaymentMethodDto) {
    return this.settingsService.updatePaymentMethod(data);
  }

  @Get("billing/invoices")
  async getInvoices() {
    return this.settingsService.getInvoices();
  }

  @Post("api-keys")
  async createApiKey(@Body() data: CreateApiKeyDto) {
    return this.settingsService.createApiKey(data);
  }

  @Get("api-keys")
  async getApiKeys() {
    return this.settingsService.getApiKeys();
  }

  @Delete("api-keys/:id")
  async deleteApiKey(@Param("id") keyId: string) {
    return this.settingsService.deleteApiKey(keyId);
  }

  @Post("webhooks")
  async createWebhook(@Body() data: CreateWebhookDto) {
    return this.settingsService.createWebhook(data);
  }

  @Get("webhooks")
  async getWebhooks() {
    return this.settingsService.getWebhooks();
  }

  @Put("webhooks/:id")
  async updateWebhook(
    @Param("id") webhookId: string,
    @Body() updates: UpdateWebhookDto
  ) {
    return this.settingsService.updateWebhook(webhookId, updates);
  }

  @Delete("webhooks/:id")
  async deleteWebhook(@Param("id") webhookId: string) {
    return this.settingsService.deleteWebhook(webhookId);
  }
}

