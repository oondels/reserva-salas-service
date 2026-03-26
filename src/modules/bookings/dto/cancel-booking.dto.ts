import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum CancelMode {
  SINGLE = 'single',
  THIS_AND_FOLLOWING = 'this_and_following',
}

export class CancelBookingDto {
  @ApiPropertyOptional({ enum: CancelMode, default: CancelMode.SINGLE })
  @IsEnum(CancelMode)
  @IsOptional()
  cancelMode?: CancelMode = CancelMode.SINGLE;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}
