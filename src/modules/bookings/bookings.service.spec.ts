import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BookingStatus, Role, RoomType } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { RoomsService } from '../rooms/rooms.service';
import { NotifyService } from '../../shared/utils/notify.service';
import { AuthUser } from '../../shared/decorators/current-user.decorator';
import { BookingConflictException } from '../../shared/exceptions/booking-conflict.exception';
import { CancelMode } from './dto/cancel-booking.dto';

const mockRoom = {
  id: 'room-1',
  name: 'Sala Alfa',
  type: RoomType.SALA,
  capacity: 10,
  floor: '1º andar',
  resources: [],
  restrictedToRoles: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBooking = {
  id: 'booking-1',
  roomId: 'room-1',
  userId: 'user-1',
  userName: 'João Silva',
  title: 'Reunião',
  description: null,
  startAt: new Date('2026-04-01T09:00:00Z'),
  endAt: new Date('2026-04-01T10:00:00Z'),
  isFullDay: false,
  status: BookingStatus.CONFIRMED,
  recurrenceRule: null,
  recurrenceGroupId: null,
  additionalNotes: null,
  approvedBy: null,
  approvedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  numberParticipants: 1,
  participantType: 'COLABORADOR',
  invites: false,
  inviteStatus: null,
  additionalItemsStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  room: mockRoom,
  additionalItems: [],
};

const adminUser: AuthUser = {
  userId: 'user-admin',
  role: 'ADMIN',
  name: 'Admin',
  email: 'admin@test.com',
};

const collaboratorUser: AuthUser = {
  userId: 'user-1',
  role: 'COLLABORATOR',
  name: 'João Silva',
  email: 'joao@test.com',
};

const facilitiesUser: AuthUser = {
  userId: 'user-fac',
  role: 'FACILITIES',
  name: 'Facilities',
  email: 'fac@test.com',
};

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepository: jest.Mocked<BookingsRepository>;
  let roomsService: jest.Mocked<RoomsService>;
  let notifyService: jest.Mocked<NotifyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingsRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByUserId: jest.fn(),
            findConflicts: jest.fn(),
            create: jest.fn(),
            createMany: jest.fn(),
            update: jest.fn(),
            cancel: jest.fn(),
            cancelRecurrenceGroup: jest.fn(),
          },
        },
        {
          provide: RoomsService,
          useValue: {
            getRoomById: jest.fn(),
            checkRoomAccess: jest.fn(),
          },
        },
        {
          provide: NotifyService,
          useValue: {
            send: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingsRepository = module.get(BookingsRepository);
    roomsService = module.get(RoomsService);
    notifyService = module.get(NotifyService);
  });

  describe('createBooking', () => {
    const dto = {
      roomId: 'room-1',
      title: 'Reunião',
      startAt: '2026-04-01T09:00:00Z',
      endAt: '2026-04-01T10:00:00Z',
    };

    it('should create a CONFIRMED booking when no additional requests', async () => {
      roomsService.getRoomById.mockResolvedValue(mockRoom as any);
      bookingsRepository.create.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const result = await service.createBooking(dto, collaboratorUser);
      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should create a PENDING booking when additional requests present', async () => {
      roomsService.getRoomById.mockResolvedValue(mockRoom as any);
      bookingsRepository.create.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING,
      } as any);

      const result = await service.createBooking(
        { ...dto, additionalRequests: ['CAFE_SIMPLES'] as any },
        collaboratorUser,
      );
      expect(result.status).toBe(BookingStatus.PENDING);
    });

    it('should throw BookingConflictException on time conflict', async () => {
      roomsService.getRoomById.mockResolvedValue(mockRoom as any);
      bookingsRepository.create.mockRejectedValue(new Error('BOOKING_CONFLICT'));

      await expect(service.createBooking(dto, collaboratorUser)).rejects.toThrow(
        BookingConflictException,
      );
    });

    it('should throw ForbiddenException for restricted room', async () => {
      roomsService.getRoomById.mockResolvedValue(mockRoom as any);
      roomsService.checkRoomAccess.mockImplementation(() => {
        throw new ForbiddenException('Sem permissão');
      });

      await expect(service.createBooking(dto, collaboratorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelBooking', () => {
    it('should cancel own booking', async () => {
      bookingsRepository.findById.mockResolvedValue(mockBooking as any);
      bookingsRepository.cancel.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      } as any);

      const result = await service.cancelBooking(
        'booking-1',
        { cancelMode: CancelMode.SINGLE },
        collaboratorUser,
      );
      expect((result as any).status).toBe(BookingStatus.CANCELLED);
    });

    it('should throw ForbiddenException when FACILITIES tries to cancel', async () => {
      bookingsRepository.findById.mockResolvedValue(mockBooking as any);

      await expect(
        service.cancelBooking(
          'booking-1',
          { cancelMode: CancelMode.SINGLE },
          facilitiesUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnprocessableEntityException when booking is already cancelled', async () => {
      bookingsRepository.findById.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      } as any);

      await expect(
        service.cancelBooking(
          'booking-1',
          { cancelMode: CancelMode.SINGLE },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      bookingsRepository.findById.mockResolvedValue(null);

      await expect(
        service.cancelBooking(
          'non-existent',
          { cancelMode: CancelMode.SINGLE },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBookingById', () => {
    it('should return booking for owner', async () => {
      bookingsRepository.findById.mockResolvedValue(mockBooking as any);

      const result = await service.getBookingById('booking-1', collaboratorUser);
      expect(result.id).toBe('booking-1');
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      bookingsRepository.findById.mockResolvedValue(null);

      await expect(
        service.getBookingById('non-existent', collaboratorUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-owner COLLABORATOR tries to view', async () => {
      bookingsRepository.findById.mockResolvedValue({
        ...mockBooking,
        userId: 'other-user',
      } as any);

      await expect(
        service.getBookingById('booking-1', collaboratorUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any booking', async () => {
      bookingsRepository.findById.mockResolvedValue({
        ...mockBooking,
        userId: 'other-user',
      } as any);

      const result = await service.getBookingById('booking-1', adminUser);
      expect(result.id).toBe('booking-1');
    });
  });

  describe('getMyBookings', () => {
    it('should return bookings for the authenticated user', async () => {
      bookingsRepository.findByUserId.mockResolvedValue([mockBooking] as any);

      const result = await service.getMyBookings(collaboratorUser);
      expect(result).toHaveLength(1);
      expect(bookingsRepository.findByUserId).toHaveBeenCalledWith(
        collaboratorUser.userId,
      );
    });
  });

  describe('listBookings', () => {
    it('should restrict COLLABORATOR to own bookings', async () => {
      bookingsRepository.findAll.mockResolvedValue({
        data: [mockBooking] as any,
        total: 1,
      });

      await service.listBookings({}, collaboratorUser);

      expect(bookingsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ userId: collaboratorUser.userId }),
      );
    });

    it('should allow ADMIN to list all bookings without userId restriction', async () => {
      bookingsRepository.findAll.mockResolvedValue({
        data: [mockBooking] as any,
        total: 1,
      });

      await service.listBookings({}, adminUser);

      const callArg = bookingsRepository.findAll.mock.calls[0][0];
      expect(callArg.userId).toBeUndefined();
    });
  });

  describe('approveBooking', () => {
    const pendingBooking = { ...mockBooking, status: BookingStatus.PENDING };

    it('should approve a PENDING booking', async () => {
      bookingsRepository.findById.mockResolvedValue(pendingBooking as any);
      bookingsRepository.update.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.CONFIRMED,
      } as any);

      const result = await service.approveBooking('booking-1', adminUser);
      expect((result as any).status).toBe(BookingStatus.CONFIRMED);
      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'BOOKING_APPROVED' }),
      );
    });

    it('should throw UnprocessableEntityException when booking is not PENDING', async () => {
      bookingsRepository.findById.mockResolvedValue(mockBooking as any); // CONFIRMED
      await expect(service.approveBooking('booking-1', adminUser)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      bookingsRepository.findById.mockResolvedValue(null);
      await expect(service.approveBooking('non-existent', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectBooking', () => {
    const pendingBooking = { ...mockBooking, status: BookingStatus.PENDING };

    it('should reject a PENDING booking', async () => {
      bookingsRepository.findById.mockResolvedValue(pendingBooking as any);
      bookingsRepository.update.mockResolvedValue({
        ...pendingBooking,
        status: BookingStatus.REJECTED,
      } as any);

      const result = await service.rejectBooking('booking-1', adminUser, 'Sala indisponível');
      expect((result as any).status).toBe(BookingStatus.REJECTED);
      expect(notifyService.send).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'BOOKING_REJECTED' }),
      );
    });

    it('should throw UnprocessableEntityException when booking is not PENDING', async () => {
      bookingsRepository.findById.mockResolvedValue(mockBooking as any);
      await expect(service.rejectBooking('booking-1', adminUser)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
