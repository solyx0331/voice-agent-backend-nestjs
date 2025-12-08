import { IsString, IsEnum, IsOptional, IsEmail } from "class-validator";

export class CreateContactDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  company: string;

  @IsOptional()
  @IsEnum(["active", "inactive", "lead"])
  status?: "active" | "inactive" | "lead";
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEnum(["active", "inactive", "lead"])
  status?: "active" | "inactive" | "lead";
}

