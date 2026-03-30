import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Room } from '../rooms/entities/room.entity';

const makeCountQb = (count: number) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(count),
});

const makeTopRoomsQb = (rows: Array<{ roomId: string; total: string }>) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});

const makeRoomQb = (rooms: Array<{ id: string; name: string; type: string }>) => ({
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rooms),
});

describe('DashboardService', () => {
  let service: DashboardService;
  let bookingRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };
  let roomRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    bookingRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(2),
    };

    roomRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(20),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('deve retornar métricas do dashboard', async () => {
    bookingRepo.createQueryBuilder
      .mockReturnValueOnce(makeCountQb(3))
      .mockReturnValueOnce(makeCountQb(10))
      .mockReturnValueOnce(makeCountQb(5))
      .mockReturnValueOnce(
        makeTopRoomsQb([
          { roomId: 'r1', total: '10' },
          { roomId: 'r2', total: '7' },
        ]),
      );

    roomRepo.createQueryBuilder.mockReturnValue(
      makeRoomQb([
        { id: 'r1', name: 'Sala A', type: 'SALA' },
        { id: 'r2', name: 'Auditório B', type: 'AUDITORIO' },
      ]),
    );

    const result = await service.getMetrics();

    expect(result.bookingsToday).toBe(3);
    expect(result.bookingsThisMonth).toBe(10);
    expect(result.pendingApproval).toBe(2);
    expect(result.occupancyRateToday).toBe(25);
    expect(result.topRoomsThisMonth).toHaveLength(2);
    expect(result.topRoomsThisMonth[0]).toEqual(
      expect.objectContaining({ roomId: 'r1', roomName: 'Sala A', totalBookings: 10 }),
    );
  });

  it('deve retornar taxa de ocupação 0 quando não há salas ativas', async () => {
    roomRepo.count.mockResolvedValue(0);
    bookingRepo.createQueryBuilder
      .mockReturnValueOnce(makeCountQb(3))
      .mockReturnValueOnce(makeCountQb(10))
      .mockReturnValueOnce(makeCountQb(5))
      .mockReturnValueOnce(makeTopRoomsQb([]));

    const result = await service.getMetrics();
    expect(result.occupancyRateToday).toBe(0);
  });

  it('deve usar fallback quando sala do top não é encontrada', async () => {
    bookingRepo.createQueryBuilder
      .mockReturnValueOnce(makeCountQb(1))
      .mockReturnValueOnce(makeCountQb(2))
      .mockReturnValueOnce(makeCountQb(1))
      .mockReturnValueOnce(makeTopRoomsQb([{ roomId: 'r-desconhecida', total: '3' }]));

    roomRepo.createQueryBuilder.mockReturnValue(makeRoomQb([]));

    const result = await service.getMetrics();
    expect(result.topRoomsThisMonth[0].roomName).toBe('Desconhecida');
  });
});