import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('Copilot')
@Controller('copilot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CopilotController {
  @Get()
  async getCopilot(@Request() req: any) {
    return { copilot: [] };
  }
}
