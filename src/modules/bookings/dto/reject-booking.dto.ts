import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'Sala indisponível nesta data' })
  @IsString()
  @IsOptional()
  reason?: string;
}
