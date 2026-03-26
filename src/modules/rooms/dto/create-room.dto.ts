import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resource, Role, RoomType } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({ example: 'Sala Alfa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: RoomType })
  @IsEnum(RoomType)
  type: RoomType;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ example: '2º andar' })
  @IsString()
  @IsNotEmpty()
  floor: string;

  @ApiPropertyOptional({ enum: Resource, isArray: true })
  @IsArray()
  @IsEnum(Resource, { each: true })
  @IsOptional()
  resources?: Resource[];

  @ApiPropertyOptional({ enum: Role, isArray: true })
  @IsArray()
  @IsEnum(Role, { each: true })
  @IsOptional()
  restrictedToRoles?: Role[];
}
