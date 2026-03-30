import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { RoomsRepository } from './rooms.repository';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomFiltersDto } from './dto/room-filters.dto';
import { Room } from './entities/room.entity';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly roomsRepository: RoomsRepository) {}

  async listRooms(
    filters: RoomFiltersDto,
  ): Promise<{ data: Room[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { data, total } = await this.roomsRepository.findAll({
      ...filters,
      page,
      limit,
    });
    return { data, total, page, limit };
  }

  async getRoomById(id: string): Promise<Room> {
    const room = await this.roomsRepository.findById(id);
    if (!room || !room.isActive) {
      throw new NotFoundException(`Sala com id "${id}" não encontrada`);
    }
    return room;
  }

  checkRoomAccess(room: Room, userRole: Role): void {
    if (
      room.restrictedToRoles.length > 0 &&
      !room.restrictedToRoles.includes(userRole)
    ) {
      throw new ForbiddenException(
        'Seu perfil não tem permissão para reservar esta sala',
      );
    }
  }

  async createRoom(dto: CreateRoomDto): Promise<Room> {
    this.logger.log(`Criando sala: ${dto.name}`);
    return this.roomsRepository.create({
      name: dto.name,
      type: dto.type,
      capacity: dto.capacity,
      floor: dto.floor,
      resources: dto.resources ?? [],
      restrictedToRoles: dto.restrictedToRoles ?? [],
    });
  }

  async updateRoom(id: string, dto: UpdateRoomDto): Promise<Room> {
    await this.getRoomById(id);
    this.logger.log(`Atualizando sala: ${id}`);
    return this.roomsRepository.update(id, dto);
  }

  async deactivateRoom(id: string): Promise<Room> {
    await this.getRoomById(id);
    this.logger.log(`Desativando sala: ${id}`);
    return this.roomsRepository.softDelete(id);
  }

  async getRoomAvailability(
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<{ occupiedSlots: { startAt: Date; endAt: Date }[] }> {
    await this.getRoomById(id);
    const slots = await this.roomsRepository.findAvailability(
      id,
      new Date(startDate),
      new Date(endDate),
    );
    return { occupiedSlots: slots };
  }
}
