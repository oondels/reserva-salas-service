import {
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AdditionalRequestType,
  AdditionalStatus,
  BookingStatus,
  Role,
} from '../../common/enums';
import { randomUUID } from 'crypto';
import { BookingsRepository } from './bookings.repository';
import { RoomsService } from '../rooms/rooms.service';
import { NotifyService } from '../../shared/utils/notify.service';
import { AuthUser } from '../../shared/decorators/current-user.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFiltersDto } from './dto/booking-filters.dto';
import { CancelBookingDto, CancelMode } from './dto/cancel-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingConflictException } from '../../shared/exceptions/booking-conflict.exception';
import { expandRecurrence } from '../../shared/utils/rrule.util';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly bookingsRepository: BookingsRepository,
    private readonly roomsService: RoomsService,
    private readonly notifyService: NotifyService,
  ) {}

  async createBooking(dto: CreateBookingDto, user: AuthUser) {
    const room = await this.roomsService.getRoomById(dto.roomId);
    this.roomsService.checkRoomAccess(room, user.role as Role);

    let startAt = new Date(dto.startAt);
    let endAt = new Date(dto.endAt);

    if (dto.isFullDay) {
      startAt.setHours(0, 0, 0, 0);
      endAt = new Date(startAt);
      endAt.setHours(23, 59, 59, 999);
    }

    const hasAdditional = (dto.additionalRequests?.length ?? 0) > 0;
    const status = hasAdditional ? BookingStatus.PENDING : BookingStatus.CONFIRMED;
    const additionalTypes = (dto.additionalRequests ?? []) as AdditionalRequestType[];

    // Reserva recorrente
    if (dto.recurrenceRule) {
      return this.createRecurringBookings(
        dto,
        user,
        room,
        startAt,
        endAt,
        status,
        additionalTypes,
        hasAdditional,
      );
    }

    // Reserva simples
    let booking: Booking | null;
    try {
      booking = await this.bookingsRepository.create(
        {
          roomId: room.id,
          userId: user.userId,
          userName: user.name,
          title: dto.title,
          description: dto.description,
          startAt,
          endAt,
          isFullDay: dto.isFullDay ?? false,
          status,
          additionalNotes: dto.additionalNotes,
          numberParticipants: dto.numberParticipants ?? 1,
          participantType: dto.participantType,
          invites: dto.invites ?? false,
          inviteStatus: dto.inviteStatus,
          additionalItemsStatus: hasAdditional ? AdditionalStatus.PENDING : undefined,
        },
        additionalTypes,
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'BOOKING_CONFLICT') {
        throw new BookingConflictException();
      }
      throw err;
    }

    if (!booking) {
      throw new InternalServerErrorException('Falha ao persistir reserva');
    }

    this.logger.log(`Reserva criada: ${booking.id} | status: ${status}`);
    this.sendCreationNotification(booking, room.name, user, hasAdditional, startAt, endAt);

    return booking;
  }

  private async createRecurringBookings(
    dto: CreateBookingDto,
    user: AuthUser,
    room: { id: string; name: string },
    startAt: Date,
    endAt: Date,
    status: BookingStatus,
    additionalTypes: AdditionalRequestType[],
    hasAdditional: boolean,
  ) {
    const occurrenceSlots = expandRecurrence(startAt, endAt, dto.recurrenceRule!);

    if (occurrenceSlots.length === 0) {
      throw new UnprocessableEntityException(
        'A regra de recorrência não gerou nenhuma ocorrência',
      );
    }

    const recurrenceGroupId = randomUUID();

    const occurrences = occurrenceSlots.map((slot) => ({
      data: {
        roomId: room.id,
        userId: user.userId,
        userName: user.name,
        title: dto.title,
        description: dto.description,
        startAt: slot.startAt,
        endAt: slot.endAt,
        isFullDay: dto.isFullDay ?? false,
        status,
        recurrenceRule: dto.recurrenceRule,
        recurrenceGroupId,
        additionalNotes: dto.additionalNotes,
        numberParticipants: dto.numberParticipants ?? 1,
        participantType: dto.participantType,
        invites: dto.invites ?? false,
        inviteStatus: dto.inviteStatus,
        additionalItemsStatus: hasAdditional ? AdditionalStatus.PENDING : undefined,
      },
      additionalTypes,
    }));

    try {
      await this.bookingsRepository.createMany(occurrences);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('BOOKING_CONFLICT:')) {
        const conflictDate = err.message.split('BOOKING_CONFLICT:')[1];
        throw new BookingConflictException(
          `Conflito de horário na ocorrência de ${conflictDate}`,
        );
      }
      throw err;
    }

    this.logger.log(
      `${occurrenceSlots.length} reservas recorrentes criadas | grupo: ${recurrenceGroupId}`,
    );
    this.sendCreationNotification(
      null,
      room.name,
      user,
      hasAdditional,
      startAt,
      endAt,
      recurrenceGroupId,
    );

    return { recurrenceGroupId, count: occurrenceSlots.length };
  }

  private sendCreationNotification(
    booking: Booking | null,
    roomName: string,
    user: AuthUser,
    hasAdditional: boolean,
    startAt: Date,
    endAt: Date,
    recurrenceGroupId?: string,
  ): void {
    const data = {
      bookingId: booking?.id,
      recurrenceGroupId,
      roomName,
      startAt,
      endAt,
      userName: user.name,
    };

    void this.notifyService.send({
      to: [user.email],
      event: hasAdditional ? 'BOOKING_PENDING_APPROVAL' : 'BOOKING_CONFIRMED',
      data,
    });
  }

  async listBookings(filters: BookingFiltersDto, user: AuthUser) {
    const resolvedFilters = { ...filters };

    if (user.role === Role.COLLABORATOR) {
      resolvedFilters.userId = user.userId;
    }

    const page = resolvedFilters.page ?? 1;
    const limit = resolvedFilters.limit ?? 20;

    const { data, total } = await this.bookingsRepository.findAll({
      ...resolvedFilters,
      startDate: resolvedFilters.startDate ? new Date(resolvedFilters.startDate) : undefined,
      endDate: resolvedFilters.endDate ? new Date(resolvedFilters.endDate) : undefined,
      page,
      limit,
    });

    return { data, total, page, limit };
  }

  async getMyBookings(user: AuthUser) {
    return this.bookingsRepository.findByUserId(user.userId);
  }

  async getBookingById(id: string, user: AuthUser) {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Reserva com id "${id}" não encontrada`);
    }

    const canView =
      booking.userId === user.userId ||
      user.role === Role.MANAGER ||
      user.role === Role.ADMIN;

    if (!canView) {
      throw new ForbiddenException('Sem permissão para visualizar esta reserva');
    }

    return booking;
  }

  async cancelBooking(id: string, dto: CancelBookingDto, user: AuthUser) {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Reserva com id "${id}" não encontrada`);
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new UnprocessableEntityException(
        `Reserva já está com status "${booking.status}" e não pode ser cancelada`,
      );
    }

    if (user.role === Role.FACILITIES) {
      throw new ForbiddenException('Perfil FACILITIES não pode cancelar reservas');
    }

    const isOwner = booking.userId === user.userId;
    const isManagerOrAdmin = user.role === Role.MANAGER || user.role === Role.ADMIN;

    if (!isOwner && !isManagerOrAdmin) {
      throw new ForbiddenException('Sem permissão para cancelar esta reserva');
    }

    this.logger.log(`Cancelando reserva ${id} por ${user.userId}`);

    if (
      dto.cancelMode === CancelMode.THIS_AND_FOLLOWING &&
      booking.recurrenceGroupId
    ) {
      await this.cancelThisAndFollowing(booking.recurrenceGroupId, booking.startAt, user.userId);
      return { message: 'Reservas canceladas com sucesso' };
    }

    const cancelled = await this.bookingsRepository.cancel(id, user.userId);

    if (!cancelled) {
      throw new NotFoundException(`Reserva com id "${id}" não encontrada`);
    }

    void this.notifyService.send({
      to: [user.email],
      event: 'BOOKING_CANCELLED',
      data: {
        bookingId: id,
        roomName: cancelled.room?.name,
        startAt: cancelled.startAt,
        endAt: cancelled.endAt,
        userName: user.name,
      },
    });

    return cancelled;
  }

  async approveBooking(id: string, user: AuthUser): Promise<unknown> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) throw new NotFoundException(`Reserva "${id}" não encontrada`);

    if (booking.status !== BookingStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Apenas reservas com status PENDING podem ser aprovadas. Status atual: ${booking.status}`,
      );
    }

    const approved = await this.bookingsRepository.update(id, {
      status: BookingStatus.CONFIRMED,
      approvedBy: user.userId,
      approvedAt: new Date(),
    });

    if (!approved) {
      throw new NotFoundException(`Reserva "${id}" não encontrada`);
    }

    this.logger.log(`Reserva ${id} aprovada por ${user.userId}`);

    void this.notifyService.send({
      to: [approved.userId],
      event: 'BOOKING_APPROVED',
      data: {
        bookingId: id,
        roomName: approved.room?.name,
        startAt: approved.startAt,
        endAt: approved.endAt,
      },
    });

    return approved;
  }

  async rejectBooking(id: string, user: AuthUser, reason?: string): Promise<unknown> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) throw new NotFoundException(`Reserva "${id}" não encontrada`);

    if (booking.status !== BookingStatus.PENDING) {
      throw new UnprocessableEntityException(
        `Apenas reservas com status PENDING podem ser rejeitadas. Status atual: ${booking.status}`,
      );
    }

    const rejected = await this.bookingsRepository.update(id, {
      status: BookingStatus.REJECTED,
    });

    if (!rejected) {
      throw new NotFoundException(`Reserva "${id}" não encontrada`);
    }

    this.logger.log(
      `Reserva ${id} rejeitada por ${user.userId}${reason ? `: ${reason}` : ''}`,
    );

    void this.notifyService.send({
      to: [rejected.userId],
      event: 'BOOKING_REJECTED',
      data: {
        bookingId: id,
        roomName: rejected.room?.name,
        startAt: rejected.startAt,
        endAt: rejected.endAt,
        reason,
      },
    });

    return rejected;
  }

  async updateBooking(id: string, dto: UpdateBookingDto, user: AuthUser): Promise<unknown> {
    const booking = await this.bookingsRepository.findById(id);
    if (!booking) throw new NotFoundException(`Reserva "${id}" não encontrada`);

    const isOwner = booking.userId === user.userId;
    if (!isOwner && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Sem permissão para editar esta reserva');
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED
    ) {
      throw new UnprocessableEntityException(
        'Não é possível editar reserva cancelada ou rejeitada',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.startAt) updateData.startAt = new Date(dto.startAt);
    if (dto.endAt) updateData.endAt = new Date(dto.endAt);
    if (dto.isFullDay !== undefined) updateData.isFullDay = dto.isFullDay;
    if (dto.additionalNotes !== undefined) updateData.additionalNotes = dto.additionalNotes;
    if (dto.numberParticipants) updateData.numberParticipants = dto.numberParticipants;

    return this.bookingsRepository.update(id, updateData);
  }

  private async cancelThisAndFollowing(
    recurrenceGroupId: string,
    fromDate: Date,
    cancelledBy: string,
  ) {
    await this.bookingsRepository.cancelRecurrenceGroup(
      recurrenceGroupId,
      fromDate,
      cancelledBy,
    );
  }
}
