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
import { Role } from '../../common/enums';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomFiltersDto } from './dto/room-filters.dto';
import { Roles } from '../../shared/decorators/roles.decorator';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista salas ativas com filtros e paginação' })
  @ApiResponse({ status: 200, description: 'Lista de salas retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  listRooms(@Query() filters: RoomFiltersDto) {
    return this.roomsService.listRooms(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna detalhes de uma sala' })
  @ApiResponse({ status: 200, description: 'Sala encontrada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Sala não encontrada' })
  getRoomById(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.getRoomById(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Retorna slots ocupados da sala em um período' })
  @ApiResponse({ status: 200, description: 'Disponibilidade retornada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Sala não encontrada' })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.roomsService.getRoomAvailability(id, startDate, endDate);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cria uma nova sala (somente ADMIN)' })
  @ApiResponse({ status: 201, description: 'Sala criada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 422, description: 'Dados inválidos' })
  createRoom(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualiza uma sala (somente ADMIN)' })
  @ApiResponse({ status: 200, description: 'Sala atualizada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Sala não encontrada' })
  updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desativa uma sala — soft delete (somente ADMIN)' })
  @ApiResponse({ status: 200, description: 'Sala desativada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Sala não encontrada' })
  deactivateRoom(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.deactivateRoom(id);
  }
}
