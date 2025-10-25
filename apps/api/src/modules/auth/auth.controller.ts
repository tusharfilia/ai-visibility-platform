/**
 * Authentication controller
 */

import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req: any) {
    const user = await this.authService.validateUser(req.user.email);
    const workspaces = await this.authService.getUserWorkspaces(req.user.userId);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        externalId: user.externalId,
        createdAt: user.createdAt,
      },
      workspaces,
    };
  }
}
