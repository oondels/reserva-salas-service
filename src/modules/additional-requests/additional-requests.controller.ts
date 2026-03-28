import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AdditionalRequestsService } from './additional-requests.service';
import { AdditionalRequestFiltersDto } from './dto/additional-request-filters.dto';
import { UpdateAdditionalRequestDto } from './dto/update-additional-request.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import type { AuthUser } from '../../shared/decorators/current-user.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

@ApiTags('Additional Requests')
@ApiBearerAuth()
@Controller('additional-requests')
export class AdditionalRequestsController {
  constructor(
    private readonly additionalRequestsService: AdditionalRequestsService,
  ) {}

  @Get()
  @Roles(Role.FACILITIES, Role.ADMIN)
  @ApiOperation({ summary: 'Lista itens de solicitações adicionais (FACILITIES e ADMIN)' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  listRequests(
    @Query() filters: AdditionalRequestFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.additionalRequestsService.listRequests(filters, user);
  }

  @Put(':id')
  @Roles(Role.FACILITIES, Role.ADMIN)
  @ApiOperation({ summary: 'Atualiza status de um item de solicitação (FACILITIES e ADMIN)' })
  @ApiResponse({ status: 200, description: 'Item atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  @ApiResponse({ status: 422, description: 'Dados inválidos' })
  updateRequestStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdditionalRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.additionalRequestsService.updateRequestStatus(id, dto, user);
  }
}
