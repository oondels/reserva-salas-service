import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { RoomsModule } from '../rooms/rooms.module';
import { SharedModule } from '../../shared/shared.module';
import { Booking } from './entities/booking.entity';
import { AdditionalRequestItem } from '../additional-requests/entities/additional-request-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, AdditionalRequestItem]), RoomsModule, SharedModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
  exports: [BookingsService],
})
export class BookingsModule {}
