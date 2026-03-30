import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdditionalRequestItem } from './entities/additional-request-item.entity';
import { AdditionalStatus } from '../../common/enums/additional-status.enum';

export interface AdditionalRequestFilters {
  status?: AdditionalStatus;
  bookingId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdditionalRequestsRepository {
  constructor(
    @InjectRepository(AdditionalRequestItem)
    private readonly itemRepo: Repository<AdditionalRequestItem>,
  ) {}

  async findAll(filters: AdditionalRequestFilters) {
    const { status, bookingId, page = 1, limit = 20 } = filters;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.booking', 'booking')
      .leftJoinAndSelect('booking.room', 'room');

    if (status) qb.andWhere('item.status = :status', { status });
    if (bookingId) qb.andWhere('item.booking_id = :bookingId', { bookingId });

    qb.orderBy('item.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: string) {
    return this.itemRepo.findOne({
      where: { id },
      relations: ['booking', 'booking.room'],
    });
  }

  async update(id: string, data: Partial<AdditionalRequestItem>) {
    await this.itemRepo.update(id, data);
    return this.itemRepo.findOne({
      where: { id },
      relations: ['booking', 'booking.room'],
    });
  }
}
