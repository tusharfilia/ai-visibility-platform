import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, ArrayNotEmpty, ArrayMinSize, IsUUID } from 'class-validator';

export class DemoSummaryRequestDto {
  @ApiProperty({ description: 'Primary brand domain to analyze', example: 'https://stripe.com' })
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'domain must be a valid URL' })
  domain!: string;

  @ApiProperty({ description: 'Optional brand name override', example: 'Stripe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiProperty({
    description: 'Optional user-provided summary to override LLM generated description',
    required: false,
    example: 'Stripe provides financial infrastructure for online businesses.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  summaryOverride?: string;
}

export class DemoPromptsRequestDto {
  @ApiProperty({ description: 'Identifier of the demo run returned by the summary step' })
  @IsString()
  @IsUUID()
  demoRunId!: string;

  @ApiProperty({
    description: 'Baseline prompts provided by the user',
    example: ['Best payment processors for startups', 'Compare Stripe and Adyen'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  seedPrompts!: string[];

  @ApiProperty({
    description: 'Optional prompts the user wants to keep from previous runs',
    required: false,
    example: ['How does Stripe pricing compare?'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  confirmedPrompts?: string[];
}

class DemoPromptsResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({
    example: [
      { text: 'Best payment platforms for online businesses', source: 'seed' },
      { text: 'How does Stripe compare with PayPal for SMBs?', source: 'llm' },
    ],
  })
  prompts!: Array<{ text: string; source: 'seed' | 'llm' | 'user' }>;

  @ApiProperty({ example: 6 })
  total!: number;
}

export class DemoPromptsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoPromptsResponseData })
  data!: DemoPromptsResponseData;
}

export class DemoCompetitorsRequestDto {
  @ApiProperty({ description: 'Identifier of the demo run returned by the summary step' })
  @IsString()
  @IsUUID()
  demoRunId!: string;

  @ApiProperty({
    description: 'Final competitor domains to use (optional – if omitted, suggestions are generated)',
    example: ['adyen.com', 'paypal.com'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  competitorDomains?: string[];
}

export class DemoRunRequestDto {
  @ApiProperty({ description: 'Identifier of the demo run returned by the summary step' })
  @IsString()
  @IsUUID()
  demoRunId!: string;

  @ApiProperty({
    description: 'Engines to use for the demo run',
    example: ['PERPLEXITY', 'BRAVE', 'AIO'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  engines?: string[];
}

class DemoSummaryResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: 'https://stripe.com' })
  domain!: string;

  @ApiProperty({ example: 'Stripe' })
  brand!: string;

  @ApiProperty({
    example: 'Stripe provides financial infrastructure for online businesses, offering payments, billing, and revenue automation tools.',
  })
  summary!: string;

  @ApiProperty({ example: 'llm', description: 'Source of the summary content (user, llm, fallback)' })
  summarySource!: string;
}

export class DemoSummaryResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoSummaryResponseData })
  data!: DemoSummaryResponseData;
}

class DemoCompetitorsResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: ['adyen.com', 'paypal.com'] })
  finalCompetitors!: string[];

  @ApiProperty({ example: ['adyen.com', 'paypal.com', 'authorize.net'] })
  suggestedCompetitors!: string[];
}

export class DemoCompetitorsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoCompetitorsResponseData })
  data!: DemoCompetitorsResponseData;
}

class DemoRunResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: ['PERPLEXITY', 'BRAVE', 'AIO'] })
  engines!: string[];

  @ApiProperty({ example: 12 })
  queuedJobs!: number;
}

export class DemoRunResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoRunResponseData })
  data!: DemoRunResponseData;
}

class DemoStatusResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: 'analysis_running' })
  status!: string;

  @ApiProperty({ example: 87 })
  progress!: number;

  @ApiProperty({ example: 12 })
  totalJobs!: number;

  @ApiProperty({ example: 9 })
  completedJobs!: number;

  @ApiProperty({ example: 1 })
  failedJobs!: number;

  @ApiProperty({ example: 2 })
  remainingJobs!: number;

  @ApiProperty({ example: '2025-11-07T02:35:10.000Z' })
  updatedAt!: string;
}

export class DemoStatusResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoStatusResponseData })
  data!: DemoStatusResponseData;
}

class DemoRunTotalsDto {
  @ApiProperty({ example: 20 })
  totalRuns!: number;

  @ApiProperty({ example: 16 })
  completedRuns!: number;

  @ApiProperty({ example: 4 })
  failedRuns!: number;

  @ApiProperty({ example: 80, description: 'Completed runs as a percentage (0-100)' })
  successRate!: number;

  @ApiProperty({ example: 20, description: 'Failed runs as a percentage (0-100)' })
  failRate!: number;

  @ApiProperty({ example: 4200, description: 'Total cost in cents' })
  totalCostCents!: number;

  @ApiProperty({ example: 210, description: 'Average cost per run in cents' })
  avgCostCents!: number;
}

class DemoShareOfVoiceRowDto {
  @ApiProperty({ example: 'Stripe' })
  entity!: string;

  @ApiProperty({ example: 42 })
  mentions!: number;

  @ApiProperty({ example: 18 })
  positiveMentions!: number;

  @ApiProperty({ example: 16 })
  neutralMentions!: number;

  @ApiProperty({ example: 8 })
  negativeMentions!: number;

  @ApiProperty({ example: 46.4, description: 'Share of voice percentage (0-100)' })
  sharePercentage!: number;
}

class DemoEnginePerformanceRowDto {
  @ApiProperty({ example: 'PERPLEXITY' })
  engine!: string;

  @ApiProperty({ example: 8 })
  totalRuns!: number;

  @ApiProperty({ example: 6 })
  successfulRuns!: number;

  @ApiProperty({ example: 2 })
  failedRuns!: number;

  @ApiProperty({ example: 75.0, description: 'Success percentage (0-100)' })
  successRate!: number;

  @ApiProperty({ example: 1600, description: 'Total cost attributed to the engine in cents' })
  totalCostCents!: number;
}

class DemoCitationRowDto {
  @ApiProperty({ example: 'techcrunch.com' })
  domain!: string;

  @ApiProperty({ example: 12 })
  references!: number;

  @ApiProperty({ example: 18.5, description: 'Share of total citations percentage (0-100)' })
  sharePercentage!: number;
}

class DemoInsightsResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: 'analysis_complete' })
  status!: string;

  @ApiProperty({ example: 94 })
  progress!: number;

  @ApiProperty({ type: DemoRunTotalsDto })
  totals!: DemoRunTotalsDto;

  @ApiProperty({ type: [DemoShareOfVoiceRowDto] })
  shareOfVoice!: DemoShareOfVoiceRowDto[];

  @ApiProperty({ type: [DemoEnginePerformanceRowDto] })
  enginePerformance!: DemoEnginePerformanceRowDto[];

  @ApiProperty({ type: [DemoCitationRowDto] })
  topCitations!: DemoCitationRowDto[];

  @ApiProperty({ type: [String], example: ['Stripe leads share of voice by 12pts over Adyen.'] })
  insightHighlights!: string[];

  @ApiProperty({ example: '2025-11-07T02:40:00.000Z' })
  generatedAt!: string;
}

export class DemoInsightsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoInsightsResponseData })
  data!: DemoInsightsResponseData;
}

class DemoRecommendationItemDto {
  @ApiProperty({ example: 'Close visibility gap with PayPal' })
  title!: string;

  @ApiProperty({ example: 'Increase prompt coverage targeting PayPal comparisons to reclaim share of voice.' })
  description!: string;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  priority!: 'high' | 'medium' | 'low';

  @ApiProperty({ enum: ['visibility', 'sentiment', 'citations', 'execution', 'coverage'], example: 'visibility' })
  category!: 'visibility' | 'sentiment' | 'citations' | 'execution' | 'coverage';

  @ApiProperty({ example: 'shareOfVoice', required: false })
  relatedMetric?: string;

  @ApiProperty({ type: [String], example: ['Launch prompts focused on PayPal vs Stripe comparisons', 'Promote customer proof points in high-intent queries'] })
  actionItems!: string[];
}

class DemoRecommendationsResponseData {
  @ApiProperty({ example: 'c1a2e9f2-1f4d-4d8e-9e3b-123456789abc' })
  demoRunId!: string;

  @ApiProperty({ example: 'demo_stripe_com' })
  workspaceId!: string;

  @ApiProperty({ example: 'analysis_complete' })
  status!: string;

  @ApiProperty({ example: 94 })
  progress!: number;

  @ApiProperty({ type: [DemoRecommendationItemDto] })
  recommendations!: DemoRecommendationItemDto[];

  @ApiProperty({ type: [DemoShareOfVoiceRowDto] })
  shareOfVoice!: DemoShareOfVoiceRowDto[];

  @ApiProperty({ type: [DemoEnginePerformanceRowDto] })
  enginePerformance!: DemoEnginePerformanceRowDto[];

  @ApiProperty({ example: '2025-11-07T02:40:00.000Z' })
  generatedAt!: string;
}

export class DemoRecommendationsResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: DemoRecommendationsResponseData })
  data!: DemoRecommendationsResponseData;
}

