import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Room } from './entities/room.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { RoomType } from '../../common/enums/room-type.enum';
import { Resource } from '../../common/enums/resource.enum';

@Injectable()
export class RoomsRepository {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async findAll(filters: {
    type?: RoomType;
    minCapacity?: number;
    resources?: Resource[];
    floor?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Room[]; total: number }> {
    const { type, minCapacity, resources, floor, page = 1, limit = 20 } = filters;

    const qb = this.roomRepo
      .createQueryBuilder('room')
      .where('room."isActive" = :active', { active: true });

    if (type) {
      qb.andWhere('room.type = :type', { type });
    }
    if (minCapacity) {
      qb.andWhere('room.capacity >= :minCapacity', { minCapacity });
    }
    if (floor) {
      qb.andWhere('room.floor = :floor', { floor });
    }
    if (resources?.length) {
      qb.andWhere('room.resources @> :resources', { resources });
    }

    qb.orderBy('room.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: string): Promise<Room | null> {
    return this.roomRepo.findOne({ where: { id } });
  }

  async create(data: Partial<Room>): Promise<Room> {
    const room = this.roomRepo.create(data);
    return this.roomRepo.save(room);
  }

  async update(id: string, data: Partial<Room>): Promise<Room> {
    await this.roomRepo.update(id, data);
    return this.roomRepo.findOne({ where: { id } }) as Promise<Room>;
  }

  async softDelete(id: string): Promise<Room> {
    await this.roomRepo.update(id, { isActive: false });
    return this.roomRepo.findOne({ where: { id } }) as Promise<Room>;
  }

  async findAvailability(
    id: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ startAt: Date; endAt: Date }[]> {
    return this.bookingRepo
      .createQueryBuilder('b')
      .select(['b.start_at AS "startAt"', 'b.end_at AS "endAt"'])
      .where('b.room_id = :id', { id })
      .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
      .andWhere('b.start_at < :endDate', { endDate })
      .andWhere('b.end_at > :startDate', { startDate })
      .orderBy('b.start_at', 'ASC')
      .getRawMany<{ startAt: Date; endAt: Date }>();
  }
}
