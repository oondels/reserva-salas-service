import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Booking } from '../bookings/entities/booking.entity';

const mockBookings = [
  {
    id: 'b1',
    title: 'Reunião A',
    userName: 'João',
    userId: 'u1',
    roomId: 'r1',
    status: 'CONFIRMED',
    startAt: new Date('2026-03-01T09:00:00Z'),
    endAt: new Date('2026-03-01T10:00:00Z'),
    isFullDay: false,
    createdAt: new Date('2026-02-28T08:00:00Z'),
    room: { id: 'r1', name: 'Sala A', type: 'SALA', floor: '1' },
  },
  {
    id: 'b2',
    title: 'Treinamento',
    userName: 'Maria',
    userId: 'u2',
    roomId: 'r2',
    status: 'PENDING',
    startAt: new Date('2026-03-01T14:00:00Z'),
    endAt: new Date('2026-03-01T16:30:00Z'),
    isFullDay: false,
    createdAt: new Date('2026-02-28T12:00:00Z'),
    room: { id: 'r2', name: 'Auditório B', type: 'AUDITORIO', floor: '2' },
  },
];

const makeBookingsReportQb = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([mockBookings, 2]),
});

const makeRoomsUsageQb = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(mockBookings),
});

describe('ReportsService', () => {
  let service: ReportsService;
  let bookingRepo: {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    bookingRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getBookingsReport', () => {
    it('deve retornar relatório paginado com filtros', async () => {
      bookingRepo.createQueryBuilder.mockReturnValue(makeBookingsReportQb());

      const result = await service.getBookingsReport({ page: 1, limit: 20 });

      expect(bookingRepo.createQueryBuilder).toHaveBeenCalledWith('b');
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve aplicar filtros opcionais na query', async () => {
      const qb = makeBookingsReportQb();
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getBookingsReport({
        status: 'CONFIRMED' as never,
        roomId: 'r1',
        userId: 'u1',
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(5);
    });
  });

  describe('exportBookings', () => {
    it('deve exportar CSV com cabeçalhos corretos', async () => {
      jest.spyOn(service, 'getBookingsReport').mockResolvedValue({
        data: mockBookings as never,
        total: 2,
        page: 1,
        limit: 10000,
      });

      const csv = await service.exportBookings({}, 'csv');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID');
      expect(csv).toContain('Sala');
      expect(csv).toContain('Status');
      expect(csv).toContain('Sala A');
    });

    it('deve exportar XLSX como Buffer', async () => {
      jest.spyOn(service, 'getBookingsReport').mockResolvedValue({
        data: mockBookings as never,
        total: 2,
        page: 1,
        limit: 10000,
      });

      const xlsx = await service.exportBookings({}, 'xlsx');
      expect(Buffer.isBuffer(xlsx)).toBe(true);
      expect(xlsx.length).toBeGreaterThan(0);
    });
  });

  describe('getRoomsUsage', () => {
    it('deve calcular horas por sala', async () => {
      bookingRepo.createQueryBuilder.mockReturnValue(makeRoomsUsageQb());

      const result = await service.getRoomsUsage({
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      });

      expect(result.data).toHaveLength(2);
      const salaA = result.data.find((r) => r.roomId === 'r1');
      expect(salaA).toBeDefined();
      expect(salaA!.totalHours).toBe(1);
      expect(salaA!.totalBookings).toBe(1);

      const audB = result.data.find((r) => r.roomId === 'r2');
      expect(audB!.totalHours).toBe(2.5);
    });
  });
});