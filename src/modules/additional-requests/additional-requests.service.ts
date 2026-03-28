import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdditionalRequestsRepository } from './additional-requests.repository';
import { AdditionalRequestFiltersDto } from './dto/additional-request-filters.dto';
import { UpdateAdditionalRequestDto } from './dto/update-additional-request.dto';
import { AuthUser } from '../../shared/decorators/current-user.decorator';

@Injectable()
export class AdditionalRequestsService {
  private readonly logger = new Logger(AdditionalRequestsService.name);

  constructor(
    private readonly repository: AdditionalRequestsRepository,
  ) {}

  async listRequests(filters: AdditionalRequestFiltersDto, user: AuthUser) {
    if (user.role !== Role.FACILITIES && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Somente FACILITIES e ADMIN podem listar solicitações adicionais',
      );
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const { data, total } = await this.repository.findAll({ ...filters, page, limit });

    return { data, total, page, limit };
  }

  async updateRequestStatus(
    id: string,
    dto: UpdateAdditionalRequestDto,
    user: AuthUser,
  ) {
    if (user.role !== Role.FACILITIES && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Somente FACILITIES e ADMIN podem atualizar solicitações adicionais',
      );
    }

    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundException(`Solicitação adicional "${id}" não encontrada`);
    }

    const { status, notes } = dto;

    this.logger.log(
      `Solicitação ${id} atualizada para ${status} por ${user.userId}`,
    );

    return this.repository.update(id, {
      status,
      notes,
      preparedBy: user.userId,
      preparedAt: new Date(),
    });
  }
}
