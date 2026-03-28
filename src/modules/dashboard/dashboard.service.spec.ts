import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

const makePrisma = () => ({
  booking: {
    count: jest.fn().mockResolvedValue(5),
    groupBy: jest.fn().mockResolvedValue([
      { roomId: 'r1', _count: { roomId: 10 } },
      { roomId: 'r2', _count: { roomId: 7 } },
    ]),
  },
  room: {
    count: jest.fn().mockResolvedValue(20),
    findMany: jest.fn().mockResolvedValue([
      { id: 'r1', name: 'Sala A', type: 'SALA' },
      { id: 'r2', name: 'Auditório B', type: 'AUDITORIO' },
    ]),
  },
});

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getMetrics', () => {
    it('deve retornar métricas do dashboard', async () => {
      const result = await service.getMetrics();

      expect(result).toHaveProperty('bookingsToday');
      expect(result).toHaveProperty('bookingsThisMonth');
      expect(result).toHaveProperty('pendingApproval');
      expect(result).toHaveProperty('occupancyRateToday');
      expect(result).toHaveProperty('topRoomsThisMonth');
    });

    it('deve calcular taxa de ocupação baseada em salas ativas', async () => {
      // 5 reservas confirmadas hoje / 20 salas ativas = 25%
      prisma.room.count.mockResolvedValue(20);
      // booking.count para confirmedToday retorna 5 (4ª chamada)
      prisma.booking.count
        .mockResolvedValueOnce(3)   // bookingsToday
        .mockResolvedValueOnce(10)  // bookingsThisMonth
        .mockResolvedValueOnce(2)   // pendingApproval
        .mockResolvedValueOnce(5);  // confirmedToday

      const result = await service.getMetrics();

      expect(result.occupancyRateToday).toBe(25);
    });

    it('deve retornar taxa de ocupação 0 quando não há salas ativas', async () => {
      prisma.room.count.mockResolvedValue(0);

      const result = await service.getMetrics();

      expect(result.occupancyRateToday).toBe(0);
    });

    it('deve retornar top 5 salas com nome e tipo', async () => {
      const result = await service.getMetrics();

      expect(result.topRoomsThisMonth).toHaveLength(2);
      const salaA = result.topRoomsThisMonth.find((r) => r.roomId === 'r1');
      expect(salaA?.roomName).toBe('Sala A');
      expect(salaA?.totalBookings).toBe(10);
    });

    it('deve lidar com sala não encontrada no mapeamento de top rooms', async () => {
      prisma.booking.groupBy.mockResolvedValue([
        { roomId: 'r-desconhecida', _count: { roomId: 3 } },
      ]);
      prisma.room.findMany.mockResolvedValue([]);

      const result = await service.getMetrics();

      expect(result.topRoomsThisMonth[0].roomName).toBe('Desconhecida');
    });
  });
});
