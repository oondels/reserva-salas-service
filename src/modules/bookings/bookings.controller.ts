import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFiltersDto } from './dto/booking-filters.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthUser } from '../../shared/decorators/current-user.decorator';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Lista todas as reservas com filtros (MANAGER, ADMIN)' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  listBookings(
    @Query() filters: BookingFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.listBookings(filters, user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna as reservas do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Reservas retornadas com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  getMyBookings(@CurrentUser() user: AuthUser) {
    return this.bookingsService.getMyBookings(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna detalhes de uma reserva' })
  @ApiResponse({ status: 200, description: 'Reserva encontrada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  getBookingById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.getBookingById(id, user);
  }

  @Post()
  @Roles(Role.COLLABORATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Cria uma reserva' })
  @ApiResponse({ status: 201, description: 'Reserva criada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão ou sala restrita' })
  @ApiResponse({ status: 409, description: 'Conflito de horário' })
  @ApiResponse({ status: 422, description: 'Dados inválidos' })
  createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.createBooking(dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancela uma reserva' })
  @ApiResponse({ status: 200, description: 'Reserva cancelada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 422, description: 'Reserva já cancelada ou rejeitada' })
  cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.cancelBooking(id, dto, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita uma reserva (dono ou ADMIN)' })
  @ApiResponse({ status: 200, description: 'Reserva atualizada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 422, description: 'Reserva cancelada ou rejeitada' })
  updateBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.updateBooking(id, dto, user);
  }

  @Post(':id/approve')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Aprova uma reserva PENDING (MANAGER, ADMIN)' })
  @ApiResponse({ status: 200, description: 'Reserva aprovada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 422, description: 'Reserva não está PENDING' })
  approveBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.approveBooking(id, user);
  }

  @Post(':id/reject')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Rejeita uma reserva PENDING (MANAGER, ADMIN)' })
  @ApiResponse({ status: 200, description: 'Reserva rejeitada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 422, description: 'Reserva não está PENDING' })
  rejectBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.rejectBooking(id, user, dto.reason);
  }
}
