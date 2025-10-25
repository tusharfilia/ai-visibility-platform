import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('Engines')
@Controller('engines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnginesController {
  @Get()
  async getEngines(@Request() req: any) {
    return { engines: [] };
  }
}
