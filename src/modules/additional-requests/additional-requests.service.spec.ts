import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdditionalStatus, Role } from '@prisma/client';
import { AdditionalRequestsService } from './additional-requests.service';
import { AdditionalRequestsRepository } from './additional-requests.repository';
import { AuthUser } from '../../shared/decorators/current-user.decorator';

const makeUser = (role: Role): AuthUser => ({
  userId: 'user-123',
  role,
  name: 'Test User',
  email: 'test@example.com',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeItem = (overrides: Record<string, unknown> = {}): any => ({
  id: 'item-uuid',
  bookingId: 'booking-uuid',
  type: 'CAFE_SIMPLES' as const,
  status: AdditionalStatus.PENDING,
  notes: null,
  preparedBy: null,
  preparedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  booking: { id: 'booking-uuid', room: { name: 'Sala A' } },
  ...overrides,
});

describe('AdditionalRequestsService', () => {
  let service: AdditionalRequestsService;
  let repository: jest.Mocked<AdditionalRequestsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdditionalRequestsService,
        {
          provide: AdditionalRequestsRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdditionalRequestsService);
    repository = module.get(AdditionalRequestsRepository);
  });

  describe('listRequests', () => {
    it('deve retornar lista para FACILITIES', async () => {
      repository.findAll.mockResolvedValue({ data: [makeItem()], total: 1 });

      const result = await service.listRequests({}, makeUser(Role.FACILITIES));

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('deve retornar lista para ADMIN', async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.listRequests({}, makeUser(Role.ADMIN));

      expect(result.total).toBe(0);
    });

    it('deve lançar ForbiddenException para COLLABORATOR', async () => {
      await expect(
        service.listRequests({}, makeUser(Role.COLLABORATOR)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar ForbiddenException para MANAGER', async () => {
      await expect(
        service.listRequests({}, makeUser(Role.MANAGER)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRequestStatus', () => {
    it('deve atualizar status e registrar preparedBy e preparedAt', async () => {
      const item = makeItem();
      const updated = makeItem({ status: AdditionalStatus.PREPARED, preparedBy: 'user-123' });
      repository.findById.mockResolvedValue(item);
      repository.update.mockResolvedValue(updated);

      const result = await service.updateRequestStatus(
        'item-uuid',
        { status: AdditionalStatus.PREPARED },
        makeUser(Role.FACILITIES),
      );

      expect(repository.update).toHaveBeenCalledWith(
        'item-uuid',
        expect.objectContaining({
          status: AdditionalStatus.PREPARED,
          preparedBy: 'user-123',
          preparedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(AdditionalStatus.PREPARED);
    });

    it('deve lançar NotFoundException para item inexistente', async () => {
      repository.findById.mockResolvedValue(null as never);

      await expect(
        service.updateRequestStatus(
          'nao-existe',
          { status: AdditionalStatus.PREPARED },
          makeUser(Role.FACILITIES),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException para COLLABORATOR', async () => {
      await expect(
        service.updateRequestStatus(
          'item-uuid',
          { status: AdditionalStatus.PREPARED },
          makeUser(Role.COLLABORATOR),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
