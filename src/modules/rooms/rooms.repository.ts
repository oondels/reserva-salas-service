import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus, Prisma, Resource, Room, RoomType } from '@prisma/client';

@Injectable()
export class RoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    type?: RoomType;
    minCapacity?: number;
    resources?: Resource[];
    floor?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Room[]; total: number }> {
    const { type, minCapacity, resources, floor, page = 1, limit = 20 } = filters;

    const where: Prisma.RoomWhereInput = {
      isActive: true,
      ...(type && { type }),
      ...(minCapacity && { capacity: { gte: minCapacity } }),
      ...(resources?.length && { resources: { hasEvery: resources } }),
      ...(floor && { floor }),
    };

    const [data, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.room.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<Room | null> {
    return this.prisma.room.findUnique({ where: { id } });
  }

  async create(data: Prisma.RoomCreateInput): Promise<Room> {
    return this.prisma.room.create({ data });
  }

  async update(id: string, data: Prisma.RoomUpdateInput): Promise<Room> {
    return this.prisma.room.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Room> {
    return this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findAvailability(
    id: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ startAt: Date; endAt: Date }[]> {
    return this.prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        startAt: { lt: endDate },
        endAt: { gt: startDate },
      },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });
  }
}
