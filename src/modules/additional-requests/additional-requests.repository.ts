import { Injectable } from '@nestjs/common';
import { AdditionalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AdditionalRequestFilters {
  status?: AdditionalStatus;
  bookingId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdditionalRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: AdditionalRequestFilters) {
    const { status, bookingId, page = 1, limit = 20 } = filters;

    const where: Prisma.AdditionalRequestItemWhereInput = {
      ...(status && { status }),
      ...(bookingId && { bookingId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.additionalRequestItem.findMany({
        where,
        include: {
          booking: {
            include: { room: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.additionalRequestItem.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.additionalRequestItem.findUnique({
      where: { id },
      include: {
        booking: {
          include: { room: true },
        },
      },
    });
  }

  async update(id: string, data: Prisma.AdditionalRequestItemUpdateInput) {
    return this.prisma.additionalRequestItem.update({
      where: { id },
      data,
      include: {
        booking: {
          include: { room: true },
        },
      },
    });
  }
}
