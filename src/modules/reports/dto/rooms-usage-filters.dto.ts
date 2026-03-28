import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class RoomsUsageFiltersDto {
  @ApiProperty({ description: 'Data início do período (ISO 8601)', example: '2026-01-01T00:00:00Z' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ description: 'Data fim do período (ISO 8601)', example: '2026-01-31T23:59:59Z' })
  @IsISO8601()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Formato de exportação', enum: ['json', 'csv', 'xlsx'], default: 'json' })
  @IsOptional()
  format?: 'json' | 'csv' | 'xlsx';
}
