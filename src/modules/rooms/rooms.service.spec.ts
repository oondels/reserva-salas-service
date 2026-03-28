import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, RoomType } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { RoomsRepository } from './rooms.repository';

const mockRoom = {
  id: 'uuid-1',
  name: 'Sala Alfa',
  type: RoomType.SALA,
  capacity: 10,
  floor: '2º andar',
  resources: [],
  restrictedToRoles: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RoomsService', () => {
  let service: RoomsService;
  let repository: jest.Mocked<RoomsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: RoomsRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            findAvailability: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    repository = module.get(RoomsRepository);
  });

  describe('listRooms', () => {
    it('should return paginated rooms list', async () => {
      repository.findAll.mockResolvedValue({ data: [mockRoom], total: 1 });
      const result = await service.listRooms({});
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter inactive rooms', async () => {
      repository.findAll.mockResolvedValue({ data: [], total: 0 });
      const result = await service.listRooms({});
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getRoomById', () => {
    it('should return room when it exists and is active', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      const result = await service.getRoomById('uuid-1');
      expect(result).toEqual(mockRoom);
    });

    it('should throw NotFoundException when room does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getRoomById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when room is inactive', async () => {
      repository.findById.mockResolvedValue({ ...mockRoom, isActive: false });
      await expect(service.getRoomById('uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkRoomAccess', () => {
    it('should allow access when room has no restrictions', () => {
      expect(() =>
        service.checkRoomAccess(mockRoom, Role.COLLABORATOR),
      ).not.toThrow();
    });

    it('should allow access when user role is in restrictedToRoles', () => {
      const restrictedRoom = { ...mockRoom, restrictedToRoles: [Role.MANAGER] };
      expect(() =>
        service.checkRoomAccess(restrictedRoom, Role.MANAGER),
      ).not.toThrow();
    });

    it('should throw ForbiddenException when user role is not in restrictedToRoles', () => {
      const restrictedRoom = { ...mockRoom, restrictedToRoles: [Role.MANAGER] };
      expect(() =>
        service.checkRoomAccess(restrictedRoom, Role.COLLABORATOR),
      ).toThrow(ForbiddenException);
    });
  });

  describe('deactivateRoom', () => {
    it('should soft delete the room', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      repository.softDelete.mockResolvedValue({ ...mockRoom, isActive: false });
      const result = await service.deactivateRoom('uuid-1');
      expect(result.isActive).toBe(false);
      expect(repository.softDelete).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw NotFoundException when room does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.deactivateRoom('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRoom', () => {
    it('should create a room and return it', async () => {
      repository.create.mockResolvedValue(mockRoom);
      const dto = {
        name: 'Sala Alfa',
        type: RoomType.SALA,
        capacity: 10,
        floor: '2º andar',
      };
      const result = await service.createRoom(dto);
      expect(result).toEqual(mockRoom);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sala Alfa' }),
      );
    });
  });

  describe('updateRoom', () => {
    it('should update room when it exists', async () => {
      repository.findById.mockResolvedValue(mockRoom);
      repository.update.mockResolvedValue({ ...mockRoom, name: 'Sala Beta' });

      const result = await service.updateRoom('uuid-1', { name: 'Sala Beta' } as any);

      expect(result.name).toBe('Sala Beta');
      expect(repository.update).toHaveBeenCalledWith('uuid-1', { name: 'Sala Beta' });
    });

    it('should throw NotFoundException when room does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateRoom('non-existent', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRoomAvailability', () => {
    it('should return occupied slots for a room', async () => {
      const slots = [
        { startAt: new Date('2026-04-01T09:00:00Z'), endAt: new Date('2026-04-01T10:00:00Z') },
      ];
      repository.findById.mockResolvedValue(mockRoom);
      repository.findAvailability.mockResolvedValue(slots as any);

      const result = await service.getRoomAvailability(
        'uuid-1',
        '2026-04-01T00:00:00Z',
        '2026-04-01T23:59:59Z',
      );

      expect(result.occupiedSlots).toHaveLength(1);
    });

    it('should throw NotFoundException when room does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getRoomAvailability('non-existent', '2026-04-01T00:00:00Z', '2026-04-01T23:59:59Z'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
