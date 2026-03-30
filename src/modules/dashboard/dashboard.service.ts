import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
  ) {}

  async getMetrics() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [bookingsToday, bookingsThisMonth, pendingApproval, confirmedToday, totalRooms, topRooms] =
      await Promise.all([
        this.bookingRepo
          .createQueryBuilder('b')
          .where('b.start_at >= :startOfDay AND b.start_at <= :endOfDay', { startOfDay, endOfDay })
          .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
          .getCount(),

        this.bookingRepo
          .createQueryBuilder('b')
          .where('b.start_at >= :startOfMonth AND b.start_at <= :endOfMonth', { startOfMonth, endOfMonth })
          .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
          .getCount(),

        this.bookingRepo.count({ where: { status: BookingStatus.PENDING } }),

        this.bookingRepo
          .createQueryBuilder('b')
          .where('b.start_at >= :startOfDay AND b.start_at <= :endOfDay', { startOfDay, endOfDay })
          .andWhere('b.status = :status', { status: BookingStatus.CONFIRMED })
          .getCount(),

        this.roomRepo.count({ where: { isActive: true } }),

        this.getTopRooms(startOfMonth, endOfMonth),
      ]);

    const occupancyRate =
      totalRooms > 0 ? Math.round((confirmedToday / totalRooms) * 100) : 0;

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
    const result = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.room_id', 'roomId')
      .addSelect('COUNT(b.id)', 'total')
      .where('b.start_at >= :startDate AND b.start_at <= :endDate', { startDate, endDate })
      .andWhere('b.status IN (:...statuses)', { statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING] })
      .groupBy('b.room_id')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany<{ roomId: string; total: string }>();

    const roomIds = result.map((r) => r.roomId);
    if (roomIds.length === 0) return [];

    const rooms = await this.roomRepo
      .createQueryBuilder('r')
      .select(['r.id', 'r.name', 'r.type'])
      .where('r.id IN (:...roomIds)', { roomIds })
      .getMany();

    return result.map((r) => {
      const room = rooms.find((rm) => rm.id === r.roomId);
      return {
        roomId: r.roomId,
        roomName: room?.name ?? 'Desconhecida',
        roomType: room?.type ?? null,
        totalBookings: parseInt(r.total, 10),
      };
    });
  }
}
