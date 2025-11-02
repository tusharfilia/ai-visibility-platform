/**
 * Evidence Controller (Test Mode - No Auth)
 * For local testing of GEO evidence features
 */

import { Controller, Get, Query } from '@nestjs/common';
import { EvidenceGraphBuilderService, EntityEvidenceGraph, FactConsensusScore } from '@ai-visibility/geo';

@Controller('geo/evidence')
export class EvidenceControllerTest {
  constructor(private evidenceBuilder: EvidenceGraphBuilderService) {}

  @Get('graph')
  async getEvidenceGraph(
    @Query('workspaceId') workspaceId?: string
  ): Promise<EntityEvidenceGraph> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    return this.evidenceBuilder.buildEvidenceGraph(targetWorkspaceId);
  }

  @Get('consensus')
  async getFactConsensus(
    @Query('workspaceId') workspaceId?: string,
    @Query('factType') factType?: 'address' | 'hours' | 'phone' | 'services' | 'pricing' | 'features'
  ): Promise<{ ok: boolean; data: FactConsensusScore[] }> {
    try {
      const targetWorkspaceId = workspaceId || 'test-workspace-id';
      const consensusScores = await this.evidenceBuilder.calculateFactLevelConsensus(
        targetWorkspaceId,
        factType
      );
      
      return {
        ok: true,
        data: consensusScores,
      };
    } catch (error) {
      console.error('Error calculating fact consensus:', error);
      return {
        ok: false,
        data: [],
      };
    }
  }
}

