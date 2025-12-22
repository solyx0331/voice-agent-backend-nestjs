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

// New Dynamic Intent Definition DTO
export class IntentDefinitionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  sampleUtterances: string[];

  @IsEnum(["semantic", "regex"])
  matchingType: "semantic" | "regex";

  @IsString()
  routingAction: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  confidenceThreshold?: number;

  @IsOptional()
  @IsString()
  regexPattern?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// New Field Schema DTO
export class FieldSchemaDto {
  @IsString()
  id: string;

  @IsString()
  label: string;

  @IsString()
  fieldName: string;

  @IsEnum(["text", "phone", "email", "number", "choice", "date", "boolean"])
  dataType: "text" | "phone" | "email" | "number" | "choice" | "date" | "boolean";

  @IsBoolean()
  required: boolean;

  @IsNumber()
  displayOrder: number;

  @IsOptional()
  @IsString()
  promptText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nlpExtractionHints?: string[];

  @IsOptional()
  @IsObject()
  validationRules?: {
    regex?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    errorMessage?: string;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  choiceOptions?: string[];

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsString()
  description?: string;
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

  @IsOptional()
  @IsString()
  secondAttemptMessage?: string;
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

export class EmailTemplateFieldDto {
  @IsString()
  label: string;

  @IsString()
  fieldName: string;

  @IsBoolean()
  includeInEmail: boolean;
}

export class EmailTemplateDto {
  @IsString()
  subjectFormat: string;

  @IsString()
  bodyTemplate: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailTemplateFieldDto)
  fields?: EmailTemplateFieldDto[];
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

export class InformationGatheringQuestionDto {
  @IsString()
  question: string;
}

export class RoutingLogicDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  condition: string;

  @IsString()
  action: string;

  @IsString()
  response: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InformationGatheringQuestionDto)
  informationGathering: InformationGatheringQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldSchemaDto)
  fieldSchemas?: FieldSchemaDto[];

  @IsOptional()
  @IsString()
  completionResponse?: string; // Response after collecting information/lead data

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingLogicDto)
  routingLogics?: RoutingLogicDto[]; // Recursive nested routing logic
}

export class BaseLogicDto {
  @IsString()
  greetingMessage: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingLogicDto)
  routingLogics?: RoutingLogicDto[];

  // Legacy fields for backward compatibility
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryIntentPrompts?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadCaptureQuestionDto)
  leadCaptureQuestions?: LeadCaptureQuestionDto[];

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
  @IsString()
  systemPrompt?: string; // Custom system prompt for the agent

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

  // New Dynamic Intent Definitions
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntentDefinitionDto)
  intentDefinitions?: IntentDefinitionDto[];

  // New Field Schemas
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldSchemaDto)
  fieldSchemas?: FieldSchemaDto[];

  // Schema version for migration/compatibility
  @IsOptional()
  @IsString()
  schemaVersion?: string;

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
  @Type(() => EmailTemplateDto)
  emailTemplate?: EmailTemplateDto;

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

  // Retell API fields for ambient sound
  @IsOptional()
  @IsEnum(["coffee-shop", "convention-hall", "summer-outdoor", "mountain-outdoor", "static-noise", "call-center"])
  ambientSound?: "coffee-shop" | "convention-hall" | "summer-outdoor" | "mountain-outdoor" | "static-noise" | "call-center"; // Ambient background sound type

  @IsOptional()
  @IsNumber()
  ambientSoundVolume?: number; // Ambient sound volume (0-2, default: 1)

  // Call recording settings
  @IsOptional()
  @IsBoolean()
  enableRecording?: boolean; // Whether to record calls (default: true)

  // Custom routing actions
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customRoutingActions?: string[]; // User-defined custom routing actions
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string; // Custom system prompt for the agent

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

  // New Dynamic Intent Definitions
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntentDefinitionDto)
  intentDefinitions?: IntentDefinitionDto[];

  // New Field Schemas
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldSchemaDto)
  fieldSchemas?: FieldSchemaDto[];

  // Schema version for migration/compatibility
  @IsOptional()
  @IsString()
  schemaVersion?: string;

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
  @Type(() => EmailTemplateDto)
  emailTemplate?: EmailTemplateDto;

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

  // Retell API fields for ambient sound
  @IsOptional()
  @IsEnum(["coffee-shop", "convention-hall", "summer-outdoor", "mountain-outdoor", "static-noise", "call-center"])
  ambientSound?: "coffee-shop" | "convention-hall" | "summer-outdoor" | "mountain-outdoor" | "static-noise" | "call-center"; // Ambient background sound type

  @IsOptional()
  @IsNumber()
  ambientSoundVolume?: number; // Ambient sound volume (0-2, default: 1)

  // Call recording settings
  @IsOptional()
  @IsBoolean()
  enableRecording?: boolean; // Whether to record calls (default: true)

  // Custom routing actions
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customRoutingActions?: string[]; // User-defined custom routing actions
}

