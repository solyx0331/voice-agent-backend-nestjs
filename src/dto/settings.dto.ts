import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsEmail } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateVoiceSettingsDto {
  @IsOptional()
  @IsString()
  voiceModel?: string;

  @IsOptional()
  @IsNumber()
  speechSpeed?: number;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class UpdateNotificationSettingsDto {
  [key: string]: boolean;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  newPassword: string;
}

export class Enable2FADto {
  @IsString()
  secret: string;

  @IsString()
  qrCode: string;
}

export class Verify2FADto {
  @IsString()
  code: string;
}

export class SessionDto {
  @IsString()
  id: string;

  @IsString()
  device: string;

  @IsString()
  location: string;

  @IsString()
  lastActive: string;

  @IsBoolean()
  current: boolean;
}

export class UpdatePaymentMethodDto {
  @IsString()
  cardNumber: string;

  @IsString()
  expiry: string;

  @IsString()
  cvv: string;

  @IsString()
  name: string;
}

export class CreateApiKeyDto {
  @IsString()
  name: string;
}

export class ApiKeyDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  key: string;

  @IsString()
  createdAt: string;

  @IsOptional()
  @IsString()
  lastUsed?: string;
}

export class CreateWebhookDto {
  @IsString()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsString()
  status?: string;
}

export class WebhookDto {
  @IsString()
  id: string;

  @IsString()
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  createdAt?: string;
}

