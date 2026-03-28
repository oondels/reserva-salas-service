import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

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

const makePrisma = () => ({
  booking: {
    findMany: jest.fn().mockResolvedValue(mockBookings),
    count: jest.fn().mockResolvedValue(2),
    groupBy: jest.fn(),
  },
  room: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getBookingsReport', () => {
    it('deve retornar relatório paginado com filtros', async () => {
      const result = await service.getBookingsReport({ page: 1, limit: 20 });

      expect(prisma.booking.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve aplicar filtro de status', async () => {
      await service.getBookingsReport({ status: 'CONFIRMED' as any });

      const callArgs = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.status).toBe('CONFIRMED');
    });

    it('deve aplicar filtro de período', async () => {
      await service.getBookingsReport({
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      });

      const callArgs = (prisma.booking.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.startAt).toBeDefined();
      expect(callArgs.where.endAt).toBeDefined();
    });
  });

  describe('exportBookings', () => {
    it('deve exportar CSV com cabeçalhos corretos', async () => {
      const csv = await service.exportBookings({}, 'csv');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID');
      expect(csv).toContain('Sala');
      expect(csv).toContain('Status');
      expect(csv).toContain('Sala A');
    });

    it('deve exportar XLSX como Buffer', async () => {
      const xlsx = await service.exportBookings({}, 'xlsx');

      expect(Buffer.isBuffer(xlsx)).toBe(true);
      expect(xlsx.length).toBeGreaterThan(0);
    });

    it('CSV deve ter linha de cabeçalho + linhas de dados', async () => {
      const csv = await service.exportBookings({}, 'csv');
      const lines = (csv as string).split('\n').filter((l) => l.trim().length > 0);
      // 1 cabeçalho + 2 registros
      expect(lines.length).toBe(3);
    });
  });

  describe('getRoomsUsage', () => {
    it('deve calcular horas por sala', async () => {
      const result = await service.getRoomsUsage({
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-31T23:59:59Z',
      });

      expect(result.data).toHaveLength(2);
      const salaA = result.data.find((r) => r.roomId === 'r1');
      expect(salaA).toBeDefined();
      expect(salaA!.totalHours).toBe(1); // 60 min = 1h
      expect(salaA!.totalBookings).toBe(1);

      const audB = result.data.find((r) => r.roomId === 'r2');
      expect(audB!.totalHours).toBe(2.5); // 150 min = 2.5h
    });
  });
});
