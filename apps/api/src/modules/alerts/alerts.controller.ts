import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertsController {
  @Get()
  async getAlerts(@Request() req: any) {
    return { alerts: [] };
  }
}
