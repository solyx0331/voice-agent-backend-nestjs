import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class LatencyDto {
  @IsNumber()
  avg: number;

  @IsNumber()
  peak: number;
}

export class TranscriptItemDto {
  @IsEnum(["user", "ai"])
  speaker: "user" | "ai";

  @IsString()
  text: string;

  @IsString()
  timestamp: string;
}

export class CreateCallDto {
  @IsString()
  contact: string;

  @IsString()
  phone: string;

  @IsString()
  agent: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsEnum(["inbound", "outbound", "missed"])
  type: "inbound" | "outbound" | "missed";

  @IsString()
  duration: string;

  @IsString()
  date: string;

  @IsString()
  time: string;

  @IsEnum(["completed", "missed", "voicemail"])
  status: "completed" | "missed" | "voicemail";

  @IsOptional()
  @IsBoolean()
  recording?: boolean;

  @IsOptional()
  @IsEnum(["success", "caller_hung_up", "speech_not_recognized", "other"])
  outcome?: "success" | "caller_hung_up" | "speech_not_recognized" | "other";

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LatencyDto)
  latency?: LatencyDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptItemDto)
  transcript?: TranscriptItemDto[];
}

export class UpdateCallDto {
  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  agent?: string;

  @IsOptional()
  @IsEnum(["inbound", "outbound", "missed"])
  type?: "inbound" | "outbound" | "missed";

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsEnum(["completed", "missed", "voicemail"])
  status?: "completed" | "missed" | "voicemail";

  @IsOptional()
  @IsBoolean()
  recording?: boolean;

  @IsOptional()
  @IsEnum(["success", "caller_hung_up", "speech_not_recognized", "other"])
  outcome?: "success" | "caller_hung_up" | "speech_not_recognized" | "other";
}

export class CallFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  agent?: string;

  @IsOptional()
  @IsEnum(["inbound", "outbound", "missed"])
  type?: "inbound" | "outbound" | "missed";

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;
}

