import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdditionalStatus } from '@prisma/client';

export class UpdateAdditionalRequestDto {
  @ApiProperty({
    description: 'Novo status do item de solicitação',
    enum: AdditionalStatus,
    example: 'PREPARED',
  })
  @IsEnum(AdditionalStatus, {
    message: 'status deve ser PREPARED ou CANCELLED',
  })
  status!: AdditionalStatus;

  @ApiPropertyOptional({ description: 'Observações sobre o preparo ou cancelamento' })
  @IsString()
  @IsOptional()
  notes?: string;
}
