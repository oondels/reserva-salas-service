import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/enums';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { RoomsUsageFiltersDto } from './dto/rooms-usage-filters.dto';
import { Roles } from '../../shared/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('bookings')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Relatório paginado de reservas com filtros (ADMIN e MANAGER)' })
  @ApiResponse({ status: 200, description: 'Relatório retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  getBookingsReport(@Query() filters: ReportFiltersDto) {
    return this.reportsService.getBookingsReport(filters);
  }

  @Get('bookings/export')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Exporta reservas em CSV ou XLSX (somente ADMIN)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiResponse({ status: 200, description: 'Arquivo de exportação gerado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async exportBookings(
    @Query() filters: ReportFiltersDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportBookings(filters, format);

    if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="reservas.xlsx"');
      res.send(result);
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="reservas.csv"');
      res.send(result);
    }
  }

  @Get('rooms/usage')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Relatório de uso de salas por período (somente ADMIN)' })
  @ApiResponse({ status: 200, description: 'Uso de salas retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  getRoomsUsage(@Query() filters: RoomsUsageFiltersDto) {
    return this.reportsService.getRoomsUsage(filters);
  }

  @Get('rooms/usage/export')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Exporta uso de salas em CSV ou XLSX (somente ADMIN)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiResponse({ status: 200, description: 'Arquivo de exportação gerado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async exportRoomsUsage(
    @Query() filters: RoomsUsageFiltersDto,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportRoomsUsage(filters, format);

    if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="uso-salas.xlsx"');
      res.send(result);
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="uso-salas.csv"');
      res.send(result);
    }
  }
}
