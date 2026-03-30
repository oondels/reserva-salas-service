import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Resource, RoomType } from '../../../common/enums';
import { Transform, Type } from 'class-transformer';

export class RoomFiltersDto {
  @ApiPropertyOptional({ enum: RoomType })
  @IsEnum(RoomType)
  @IsOptional()
  type?: RoomType;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  minCapacity?: number;

  @ApiPropertyOptional({ enum: Resource, isArray: true })
  @IsEnum(Resource, { each: true })
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsOptional()
  resources?: Resource[];

  @ApiPropertyOptional({ example: '2º andar' })
  @IsString()
  @IsOptional()
  floor?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
