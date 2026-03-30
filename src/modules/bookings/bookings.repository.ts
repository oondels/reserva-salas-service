import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { AdditionalRequestItem } from '../additional-requests/entities/additional-request-item.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { AdditionalRequestType } from '../../common/enums/additional-request-type.enum';

export interface BookingFilters {
  roomId?: string;
  userId?: string;
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class BookingsRepository {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll(filters: BookingFilters) {
    const { roomId, userId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.room', 'room')
      .leftJoinAndSelect('b.additionalItems', 'additionalItems');

    if (roomId) qb.andWhere('b.room_id = :roomId', { roomId });
    if (userId) qb.andWhere('b.user_id = :userId', { userId });
    if (status) qb.andWhere('b.status = :status', { status });
    if (startDate) qb.andWhere('b.start_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('b.end_at <= :endDate', { endDate });

    qb.orderBy('b.start_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: string) {
    return this.bookingRepo.findOne({
      where: { id },
      relations: ['room', 'additionalItems'],
    });
  }

  async findByUserId(userId: string) {
    return this.bookingRepo.find({
      where: { userId },
      relations: ['room', 'additionalItems'],
      order: { startAt: 'ASC' },
    });
  }

  async findConflicts(roomId: string, startAt: Date, endAt: Date, excludeId?: string) {
    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .select('b.id')
      .where('b.room_id = :roomId', { roomId })
      .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
      .andWhere('b.start_at < :endAt', { endAt })
      .andWhere('b.end_at > :startAt', { startAt });

    if (excludeId) {
      qb.andWhere('b.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  async create(
    data: Partial<Booking> & { roomId: string },
    additionalTypes: AdditionalRequestType[],
  ) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const conflicts = await manager.query<{ id: string }[]>(
        `SELECT id FROM rh.bookings
         WHERE room_id = $1
           AND status IN ('CONFIRMED', 'PENDING')
           AND start_at < $2
           AND end_at > $3
         FOR UPDATE`,
        [data.roomId, data.endAt, data.startAt],
      );

      if (conflicts.length > 0) {
        throw new Error('BOOKING_CONFLICT');
      }

      const booking = manager.create(Booking, data);
      const saved = await manager.save(Booking, booking);

      if (additionalTypes.length > 0) {
        const items = additionalTypes.map((type) =>
          manager.create(AdditionalRequestItem, { bookingId: saved.id, type }),
        );
        await manager.save(AdditionalRequestItem, items);
      }

      return manager.findOne(Booking, {
        where: { id: saved.id },
        relations: ['room', 'additionalItems'],
      });
    });
  }

  async createMany(
    occurrences: Array<{ data: Partial<Booking> & { roomId: string }; additionalTypes: AdditionalRequestType[] }>,
  ): Promise<{ count: number }> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      for (const { data } of occurrences) {
        const conflicts = await manager.query<{ id: string }[]>(
          `SELECT id FROM rh.bookings
           WHERE room_id = $1
             AND status IN ('CONFIRMED', 'PENDING')
             AND start_at < $2
             AND end_at > $3
           FOR UPDATE`,
          [data.roomId, data.endAt, data.startAt],
        );

        if (conflicts.length > 0) {
          throw new Error(`BOOKING_CONFLICT:${(data.startAt as Date).toISOString()}`);
        }
      }

      let count = 0;
      for (const { data, additionalTypes } of occurrences) {
        const booking = manager.create(Booking, data);
        const saved = await manager.save(Booking, booking);

        if (additionalTypes.length > 0) {
          const items = additionalTypes.map((type) =>
            manager.create(AdditionalRequestItem, { bookingId: saved.id, type }),
          );
          await manager.save(AdditionalRequestItem, items);
        }
        count++;
      }

      return { count };
    });
  }

  async update(id: string, data: Partial<Booking>) {
    await this.bookingRepo.update(id, data);
    return this.bookingRepo.findOne({
      where: { id },
      relations: ['room', 'additionalItems'],
    });
  }

  async cancel(id: string, cancelledBy: string) {
    await this.bookingRepo.update(id, {
      status: BookingStatus.CANCELLED,
      cancelledBy,
      cancelledAt: new Date(),
    });
    return this.bookingRepo.findOne({
      where: { id },
      relations: ['room', 'additionalItems'],
    });
  }

  async cancelRecurrenceGroup(recurrenceGroupId: string, fromDate: Date, cancelledBy: string) {
    return this.bookingRepo
      .createQueryBuilder()
      .update(Booking)
      .set({ status: BookingStatus.CANCELLED, cancelledBy, cancelledAt: new Date() })
      .where('recurrence_group_id = :recurrenceGroupId', { recurrenceGroupId })
      .andWhere('start_at >= :fromDate', { fromDate })
      .andWhere('status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
      .execute();
  }
}
