import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AdditionalStatus } from '../../../common/enums';
import { Type } from 'class-transformer';

export class AdditionalRequestFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar por status do item', enum: AdditionalStatus })
  @IsEnum(AdditionalStatus)
  @IsOptional()
  status?: AdditionalStatus;

  @ApiPropertyOptional({ description: 'Filtrar por ID da reserva' })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Itens por página', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
