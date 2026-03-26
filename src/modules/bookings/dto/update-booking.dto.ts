import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookingDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  startAt?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  endAt?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  numberParticipants?: number;
}
