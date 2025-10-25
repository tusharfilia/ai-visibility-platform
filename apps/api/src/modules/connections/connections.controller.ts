import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('Connections')
@Controller('connections')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConnectionsController {
  @Get()
  async getConnections(@Request() req: any) {
    return { connections: [] };
  }
}
