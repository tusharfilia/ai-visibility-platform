import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContentGeneratorService, ContentGenerationRequest, GeneratedContent } from '@ai-visibility/content';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { WorkspaceAccessGuard } from '../../guards/workspace-access.guard';

@ApiTags('Content Generation')
@ApiBearerAuth()
@Controller('v1/content')
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
export class ContentController {
  constructor(private contentGenerator: ContentGeneratorService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate GEO-optimized content' })
  @ApiResponse({ status: 200, description: 'Content generated successfully' })
  async generateContent(
    @Param('workspaceId') workspaceId: string,
    @Body() request: ContentGenerationRequest
  ): Promise<{ ok: boolean; data: GeneratedContent }> {
    const content = await this.contentGenerator.generateContent(workspaceId, request);
    
    return {
      ok: true,
      data: content,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get generated content by ID' })
  @ApiResponse({ status: 200, description: 'Content retrieved successfully' })
  async getContent(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string
  ): Promise<{ ok: boolean; data: GeneratedContent }> {
    // TODO: Implement content retrieval from database
    // For now, return a placeholder
    const content: GeneratedContent = {
      id,
      type: 'blog',
      title: 'Sample Content',
      content: 'This is sample content...',
      metaDescription: 'Sample meta description',
      keywords: ['sample', 'content'],
      cost: 0.05,
      tokens: { prompt: 100, completion: 200, total: 300 },
      createdAt: new Date(),
    };
    
    return {
      ok: true,
      data: content,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update generated content' })
  @ApiResponse({ status: 200, description: 'Content updated successfully' })
  async updateContent(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() updates: Partial<GeneratedContent>
  ): Promise<{ ok: boolean; data: GeneratedContent }> {
    // TODO: Implement content update in database
    console.log(`Updating content ${id} for workspace ${workspaceId}:`, updates);
    
    return {
      ok: true,
      data: {
        id,
        type: 'blog',
        title: 'Updated Content',
        content: 'This is updated content...',
        metaDescription: 'Updated meta description',
        keywords: ['updated', 'content'],
        cost: 0.05,
        tokens: { prompt: 100, completion: 200, total: 300 },
        createdAt: new Date(),
      },
    };
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Export content to PDF/DOCX' })
  @ApiResponse({ status: 200, description: 'Content exported successfully' })
  async exportContent(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() options: { format: 'pdf' | 'docx'; includeSchema?: boolean }
  ): Promise<{ ok: boolean; data: { downloadUrl: string; expiresAt: Date } }> {
    // TODO: Implement content export functionality
    console.log(`Exporting content ${id} for workspace ${workspaceId}:`, options);
    
    return {
      ok: true,
      data: {
        downloadUrl: `https://storage.example.com/exports/${id}.${options.format}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    };
  }

  @Get('templates/:type')
  @ApiOperation({ summary: 'Get content templates by type' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(
    @Param('type') type: 'blog' | 'faq' | 'landing' | 'social'
  ): Promise<{ ok: boolean; data: { templates: any[] } }> {
    const templates = {
      blog: [
        { name: 'How-to Guide', description: 'Step-by-step instructional content' },
        { name: 'Industry Analysis', description: 'Deep dive into industry trends' },
        { name: 'Product Review', description: 'Comprehensive product analysis' },
      ],
      faq: [
        { name: 'Product FAQ', description: 'Common product questions' },
        { name: 'Service FAQ', description: 'Service-related questions' },
        { name: 'General FAQ', description: 'General company questions' },
      ],
      landing: [
        { name: 'Product Landing', description: 'Product-focused landing page' },
        { name: 'Service Landing', description: 'Service-focused landing page' },
        { name: 'Lead Generation', description: 'Lead capture landing page' },
      ],
      social: [
        { name: 'Educational Post', description: 'Educational social media content' },
        { name: 'Behind the Scenes', description: 'Company culture content' },
        { name: 'Industry News', description: 'Industry updates and news' },
      ],
    };
    
    return {
      ok: true,
      data: {
        templates: templates[type] || [],
      },
    };
  }

  @Post('batch-generate')
  @ApiOperation({ summary: 'Generate multiple content pieces in batch' })
  @ApiResponse({ status: 200, description: 'Batch content generation completed' })
  async batchGenerateContent(
    @Param('workspaceId') workspaceId: string,
    @Body() requests: ContentGenerationRequest[]
  ): Promise<{ ok: boolean; data: { results: GeneratedContent[]; totalCost: number } }> {
    const results: GeneratedContent[] = [];
    let totalCost = 0;
    
    for (const request of requests) {
      try {
        const content = await this.contentGenerator.generateContent(workspaceId, request);
        results.push(content);
        totalCost += content.cost;
      } catch (error) {
        console.error(`Failed to generate content for request:`, request, error);
        // Continue with other requests
      }
    }
    
    return {
      ok: true,
      data: {
        results,
        totalCost,
      },
    };
  }
}

