import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { BookingStatus } from '../../common/enums';
import { Booking } from '../bookings/entities/booking.entity';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { RoomsUsageFiltersDto } from './dto/rooms-usage-filters.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async getBookingsReport(filters: ReportFiltersDto) {
    const { status, roomId, userId, startDate, endDate, page = 1, limit = 20 } = filters;

    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.room', 'room');

    if (status) {
      qb.andWhere('b.status = :status', { status });
    }
    if (roomId) {
      qb.andWhere('b.room_id = :roomId', { roomId });
    }
    if (userId) {
      qb.andWhere('b.user_id = :userId', { userId });
    }
    if (startDate) {
      qb.andWhere('b.start_at >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('b.end_at <= :endDate', { endDate: new Date(endDate) });
    }

    qb.orderBy('b.start_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async exportBookings(filters: ReportFiltersDto, format: 'csv' | 'xlsx') {
    const allFilters = { ...filters, page: 1, limit: 10000 };
    const { data } = await this.getBookingsReport(allFilters);

    const rows = data.map((b) => ({
      ID: b.id,
      Título: b.title,
      Sala: b.room?.name ?? '',
      Tipo: b.room?.type ?? '',
      Andar: b.room?.floor ?? '',
      Usuário: b.userName,
      Status: b.status,
      Início: b.startAt.toISOString(),
      Fim: b.endAt.toISOString(),
      'Dia Inteiro': b.isFullDay ? 'Sim' : 'Não',
      Criado: b.createdAt.toISOString(),
    }));

    this.logger.log(`Exportando ${rows.length} reservas em formato ${format}`);

    if (format === 'csv') {
      return this.toCsv(rows);
    }

    return this.toXlsx(rows);
  }

  async getRoomsUsage(filters: RoomsUsageFiltersDto) {
    const { startDate, endDate } = filters;

    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.room', 'room')
      .where('b.start_at >= :startDate', { startDate: new Date(startDate) })
      .andWhere('b.end_at <= :endDate', { endDate: new Date(endDate) })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
      })
      .getMany();

    const usageMap = new Map<
      string,
      { roomName: string; roomType: string; floor: string; totalMinutes: number; totalBookings: number }
    >();

    for (const b of bookings) {
      const minutes = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000);
      const existing = usageMap.get(b.roomId);
      if (existing) {
        existing.totalMinutes += minutes;
        existing.totalBookings += 1;
      } else {
        usageMap.set(b.roomId, {
          roomName: b.room?.name ?? '',
          roomType: String(b.room?.type ?? ''),
          floor: b.room?.floor ?? '',
          totalMinutes: minutes,
          totalBookings: 1,
        });
      }
    }

    const result = Array.from(usageMap.entries()).map(([roomId, usage]) => ({
      roomId,
      ...usage,
      totalHours: Math.round((usage.totalMinutes / 60) * 10) / 10,
    }));

    result.sort((a, b) => b.totalMinutes - a.totalMinutes);

    return { data: result, period: { startDate, endDate } };
  }

  async exportRoomsUsage(filters: RoomsUsageFiltersDto, format: 'csv' | 'xlsx') {
    const { data } = await this.getRoomsUsage(filters);

    const rows = data.map((r) => ({
      'ID Sala': r.roomId,
      Sala: r.roomName,
      Tipo: r.roomType,
      Andar: r.floor,
      'Total Reservas': r.totalBookings,
      'Horas Reservadas': r.totalHours,
    }));

    if (format === 'csv') {
      return this.toCsv(rows);
    }

    return this.toXlsx(rows);
  }

  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h] ?? '');
            return val.includes(',') || val.includes('"') || val.includes('\n')
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(','),
      ),
    ];

    return lines.join('\n');
  }

  private toXlsx(rows: Record<string, unknown>[]): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
