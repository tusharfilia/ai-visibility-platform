/**
 * E-E-A-T Controller (Test Mode - No Auth)
 * For local testing of GEO features
 */

import { Controller, Get, Query } from '@nestjs/common';
import { EEATCalculatorService, EEATScore } from '@ai-visibility/geo';

@Controller('geo')
export class EEATControllerTest {
  constructor(
    private eeatCalculator: EEATCalculatorService
  ) {}

  @Get('eeat')
  async getEEATScore(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{ ok: boolean; data: EEATScore | null }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      const score = await this.eeatCalculator.calculateEEATScore(targetWorkspaceId);
      
      return {
        ok: true,
        data: score,
      };
    } catch (error) {
      console.error('Error calculating E-E-A-T score:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        ok: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      } as any;
    }
  }
}

