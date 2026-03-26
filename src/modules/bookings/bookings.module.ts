import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { RoomsModule } from '../rooms/rooms.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [RoomsModule, SharedModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
  exports: [BookingsService],
})
export class BookingsModule {}
