import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotifyService } from './utils/notify.service';

@Module({
  imports: [HttpModule],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class SharedModule {}
