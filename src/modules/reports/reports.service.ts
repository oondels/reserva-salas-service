import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { RoomsUsageFiltersDto } from './dto/rooms-usage-filters.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBookingsReport(filters: ReportFiltersDto) {
    const { status, roomId, userId, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Prisma.BookingWhereInput = {
      ...(status && { status }),
      ...(roomId && { roomId }),
      ...(userId && { userId }),
      ...(startDate && { startAt: { gte: new Date(startDate) } }),
      ...(endDate && { endAt: { lte: new Date(endDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: { room: { select: { id: true, name: true, type: true, floor: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

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

    const bookings = await this.prisma.booking.findMany({
      where: {
        startAt: { gte: new Date(startDate) },
        endAt: { lte: new Date(endDate) },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      select: {
        roomId: true,
        startAt: true,
        endAt: true,
        room: { select: { id: true, name: true, type: true, floor: true } },
      },
    });

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
