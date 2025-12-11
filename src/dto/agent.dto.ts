import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class VoiceConfigDto {
  @IsEnum(["generic", "custom"])
  type: "generic" | "custom";

  @IsOptional()
  @IsString()
  genericVoice?: string;

  @IsOptional()
  @IsString()
  customVoiceId?: string;

  @IsOptional()
  @IsString()
  customVoiceUrl?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number; // Voice stability (0-2)

  @IsOptional()
  @IsNumber()
  speed?: number; // Speech speed (0.5-2)

  @IsOptional()
  @IsNumber()
  volume?: number; // Volume level (0-2)
}

export class FAQDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class IntentDto {
  @IsString()
  name: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  response?: string;
}

export class BusinessHoursScheduleDto {
  @IsString()
  day: string;

  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class BusinessHoursDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  timezone: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursScheduleDto)
  schedule: BusinessHoursScheduleDto[];
}

export class CallRulesDto {
  @IsObject()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  businessHours: BusinessHoursDto;

  @IsBoolean()
  fallbackToVoicemail: boolean;

  @IsOptional()
  @IsString()
  voicemailMessage?: string;
}

export class LeadCaptureFieldDto {
  @IsString()
  name: string;

  @IsString()
  question: string;

  @IsBoolean()
  required: boolean;

  @IsEnum(["text", "email", "phone", "number"])
  type: "text" | "email" | "phone" | "number";
}

export class LeadCaptureDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadCaptureFieldDto)
  fields: LeadCaptureFieldDto[];
}

export class CrmConfigDto {
  @IsEnum(["webhook", "salesforce", "hubspot", "zapier"])
  type: "webhook" | "salesforce" | "hubspot" | "zapier";

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class NotificationsDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CrmConfigDto)
  crm?: CrmConfigDto;
}

export class LeadCaptureQuestionDto {
  @IsString()
  question: string;
}

export class ResponseLogicDto {
  @IsString()
  condition: string;

  @IsString()
  action: string;

  @IsString()
  response: string;
}

export class BaseLogicDto {
  @IsString()
  greetingMessage: string;

  @IsArray()
  @IsString({ each: true })
  primaryIntentPrompts: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadCaptureQuestionDto)
  leadCaptureQuestions: LeadCaptureQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResponseLogicDto)
  responseLogic?: ResponseLogicDto[];
}

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(["active", "inactive", "busy"])
  status?: "active" | "inactive" | "busy";

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VoiceConfigDto)
  voice?: VoiceConfigDto;

  @IsOptional()
  @IsString()
  greetingScript?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FAQDto)
  faqs?: FAQDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntentDto)
  intents?: IntentDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CallRulesDto)
  callRules?: CallRulesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LeadCaptureDto)
  leadCapture?: LeadCaptureDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationsDto)
  notifications?: NotificationsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BaseLogicDto)
  baseLogic?: BaseLogicDto;

  // Retell API fields for agent behavior
  @IsOptional()
  @IsNumber()
  responsiveness?: number; // How responsive the agent is (0-1)

  @IsOptional()
  @IsNumber()
  interruptionSensitivity?: number; // How easily user can interrupt (0-1)

  // Retell API fields for call management
  @IsOptional()
  @IsNumber()
  endCallAfterSilenceMs?: number; // End call after silence (min 10000ms)

  @IsOptional()
  @IsNumber()
  maxCallDurationMs?: number; // Max call duration (60000-7200000ms)

  @IsOptional()
  @IsNumber()
  beginMessageDelayMs?: number; // Delay before first message (0-5000ms)
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(["active", "inactive", "busy"])
  status?: "active" | "inactive" | "busy";

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VoiceConfigDto)
  voice?: VoiceConfigDto;

  @IsOptional()
  @IsString()
  greetingScript?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FAQDto)
  faqs?: FAQDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntentDto)
  intents?: IntentDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CallRulesDto)
  callRules?: CallRulesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LeadCaptureDto)
  leadCapture?: LeadCaptureDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationsDto)
  notifications?: NotificationsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BaseLogicDto)
  baseLogic?: BaseLogicDto;

  // Retell API fields for agent behavior
  @IsOptional()
  @IsNumber()
  responsiveness?: number; // How responsive the agent is (0-1)

  @IsOptional()
  @IsNumber()
  interruptionSensitivity?: number; // How easily user can interrupt (0-1)

  // Retell API fields for call management
  @IsOptional()
  @IsNumber()
  endCallAfterSilenceMs?: number; // End call after silence (min 10000ms)

  @IsOptional()
  @IsNumber()
  maxCallDurationMs?: number; // Max call duration (60000-7200000ms)

  @IsOptional()
  @IsNumber()
  beginMessageDelayMs?: number; // Delay before first message (0-5000ms)
}

