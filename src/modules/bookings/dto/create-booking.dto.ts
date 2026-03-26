import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdditionalRequestType, InviteStatus, ParticipantType } from '@prisma/client';

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  roomId: string;

  @ApiProperty({ example: 'Reunião de planejamento' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-04-01T09:00:00Z' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-04-01T10:00:00Z' })
  @IsISO8601()
  endAt: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;

  @ApiPropertyOptional({ example: 'FREQ=WEEKLY;BYDAY=TU;COUNT=4' })
  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @ApiPropertyOptional({ enum: AdditionalRequestType, isArray: true })
  @IsArray()
  @IsEnum(AdditionalRequestType, { each: true })
  @IsOptional()
  additionalRequests?: AdditionalRequestType[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberParticipants?: number;

  @ApiPropertyOptional({ enum: ParticipantType })
  @IsEnum(ParticipantType)
  @IsOptional()
  participantType?: ParticipantType;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  invites?: boolean;

  @ApiPropertyOptional({ enum: InviteStatus })
  @IsEnum(InviteStatus)
  @IsOptional()
  inviteStatus?: InviteStatus;
}
