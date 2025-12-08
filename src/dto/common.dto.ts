import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean } from "class-validator";

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class SearchDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class DateRangeDto {
  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;
}

