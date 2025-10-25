import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('Prompts')
@Controller('prompts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PromptsController {
  @Get()
  async getPrompts(@Request() req: any) {
    return { prompts: [] };
  }

  @Post()
  async createPrompt(@Body() body: any, @Request() req: any) {
    return { prompt: body };
  }
}
