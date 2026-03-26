import { Injectable } from '@nestjs/common';
import { AdditionalRequestType, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: BookingFilters) {
    const { roomId, userId, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Prisma.BookingWhereInput = {
      ...(roomId && { roomId }),
      ...(userId && { userId }),
      ...(status && { status }),
      ...(startDate && { startAt: { gte: startDate } }),
      ...(endDate && { endAt: { lte: endDate } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { room: true, additionalItems: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: { room: true, additionalItems: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { room: true, additionalItems: true },
      orderBy: { startAt: 'asc' },
    });
  }

  async findConflicts(
    roomId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    // FOR UPDATE lock para evitar race conditions — deve ser chamado dentro de $transaction
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM rh.bookings
      WHERE room_id = ${roomId}
        AND status IN ('CONFIRMED', 'PENDING')
        AND start_at < ${endAt}
        AND end_at > ${startAt}
        ${excludeId ? Prisma.sql`AND id != ${excludeId}` : Prisma.empty}
      FOR UPDATE
    `;
    return result;
  }

  async create(data: Prisma.BookingCreateInput, additionalTypes: AdditionalRequestType[]) {
    return this.prisma.$transaction(async (tx) => {
      // Verificar conflito com lock dentro da transação
      const conflicts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM rh.bookings
        WHERE room_id = ${(data.room as { connect: { id: string } }).connect.id}
          AND status IN ('CONFIRMED', 'PENDING')
          AND start_at < ${data.endAt}
          AND end_at > ${data.startAt}
        FOR UPDATE
      `;

      if (conflicts.length > 0) {
        throw new Error('BOOKING_CONFLICT');
      }

      const booking = await tx.booking.create({
        data: {
          ...data,
          additionalItems:
            additionalTypes.length > 0
              ? {
                  create: additionalTypes.map((type) => ({ type })),
                }
              : undefined,
        },
        include: { room: true, additionalItems: true },
      });

      return booking;
    });
  }

  async createMany(
    occurrences: Array<{
      data: Prisma.BookingCreateInput;
      additionalTypes: AdditionalRequestType[];
    }>,
  ): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Verificar conflitos com FOR UPDATE para TODAS as ocorrências antes de persistir qualquer uma
      for (const { data } of occurrences) {
        const roomId = (data.room as { connect: { id: string } }).connect.id;
        const conflicts = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM rh.bookings
          WHERE room_id = ${roomId}
            AND status IN ('CONFIRMED', 'PENDING')
            AND start_at < ${data.endAt}
            AND end_at > ${data.startAt}
          FOR UPDATE
        `;
        if (conflicts.length > 0) {
          throw new Error(`BOOKING_CONFLICT:${(data.startAt as Date).toISOString()}`);
        }
      }

      // Persistir todas as ocorrências
      let count = 0;
      for (const { data, additionalTypes } of occurrences) {
        await tx.booking.create({
          data: {
            ...data,
            additionalItems:
              additionalTypes.length > 0
                ? { create: additionalTypes.map((type) => ({ type })) }
                : undefined,
          },
        });
        count++;
      }

      return { count };
    });
  }

  async update(id: string, data: Prisma.BookingUpdateInput) {
    return this.prisma.booking.update({
      where: { id },
      data,
      include: { room: true, additionalItems: true },
    });
  }

  async cancel(id: string, cancelledBy: string) {
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy,
        cancelledAt: new Date(),
      },
      include: { room: true, additionalItems: true },
    });
  }

  async cancelRecurrenceGroup(
    recurrenceGroupId: string,
    fromDate: Date,
    cancelledBy: string,
  ) {
    return this.prisma.booking.updateMany({
      where: {
        recurrenceGroupId,
        startAt: { gte: fromDate },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy,
        cancelledAt: new Date(),
      },
    });
  }
}
