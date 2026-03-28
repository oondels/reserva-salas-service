import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      bookingsToday,
      bookingsThisMonth,
      pendingApproval,
      confirmedToday,
      topRooms,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          startAt: { gte: startOfDay, lte: endOfDay },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
      }),

      this.prisma.booking.count({
        where: {
          startAt: { gte: startOfMonth, lte: endOfMonth },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
      }),

      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),

      this.prisma.booking.count({
        where: {
          startAt: { gte: startOfDay, lte: endOfDay },
          status: BookingStatus.CONFIRMED,
        },
      }),

      this.getTopRooms(startOfMonth, endOfMonth),
    ]);

    const totalRooms = await this.prisma.room.count({ where: { isActive: true } });
    const totalPossibleSlots = totalRooms;
    const occupancyRate =
      totalPossibleSlots > 0
        ? Math.round((confirmedToday / totalPossibleSlots) * 100)
        : 0;

    this.logger.log('Métricas do dashboard consultadas');

    return {
      bookingsToday,
      bookingsThisMonth,
      pendingApproval,
      occupancyRateToday: occupancyRate,
      topRoomsThisMonth: topRooms,
    };
  }

  private async getTopRooms(startDate: Date, endDate: Date) {
    const result = await this.prisma.booking.groupBy({
      by: ['roomId'],
      where: {
        startAt: { gte: startDate, lte: endDate },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      _count: { roomId: true },
      orderBy: { _count: { roomId: 'desc' } },
      take: 5,
    });

    const roomIds = result.map((r) => r.roomId);
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, name: true, type: true },
    });

    return result.map((r) => {
      const room = rooms.find((rm) => rm.id === r.roomId);
      return {
        roomId: r.roomId,
        roomName: room?.name ?? 'Desconhecida',
        roomType: room?.type ?? null,
        totalBookings: r._count.roomId,
      };
    });
  }
}
