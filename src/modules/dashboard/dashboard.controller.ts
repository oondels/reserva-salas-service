import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../shared/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Retorna métricas do dashboard (MANAGER e ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Métricas retornadas com sucesso',
    schema: {
      example: {
        bookingsToday: 12,
        bookingsThisMonth: 85,
        pendingApproval: 3,
        occupancyRateToday: 60,
        topRoomsThisMonth: [
          { roomId: 'uuid', roomName: 'Sala A', roomType: 'SALA', totalBookings: 20 },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  getMetrics() {
    return this.dashboardService.getMetrics();
  }
}
