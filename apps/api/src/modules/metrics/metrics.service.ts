/**
 * Metrics service
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(workspaceId: string, from?: Date, to?: Date): Promise<any> {
    const whereClause: any = { workspaceId };
    
    if (from || to) {
      whereClause.date = {};
      if (from) whereClause.date.gte = from;
      if (to) whereClause.date.lte = to;
    }

    const metrics = await this.prisma.metricDaily.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    if (metrics.length === 0) {
      return {
        promptSOV: 0,
        coverage: 0,
        citationVelocity: 0,
        aioImpressions: 0,
        timeseries: [],
      };
    }

    // Calculate averages
    const avgSOV = metrics.reduce((sum: number, m: any) => sum + m.promptSOV, 0) / metrics.length;
    const avgCoverage = metrics.reduce((sum: number, m: any) => sum + m.coverage, 0) / metrics.length;
    const totalCitations = metrics.reduce((sum: number, m: any) => sum + m.citationCount, 0);
    const citationVelocity = totalCitations / metrics.length;
    const totalAioImpressions = metrics.reduce((sum: number, m: any) => sum + m.aioImpressions, 0);

    // Generate timeseries
    const timeseries = metrics.map((m: any) => ({
      date: m.date.toISOString().split('T')[0],
      sov: m.promptSOV,
    }));

    return {
      promptSOV: Math.round(avgSOV * 100) / 100,
      coverage: Math.round(avgCoverage * 100) / 100,
      citationVelocity: Math.round(citationVelocity * 100) / 100,
      aioImpressions: totalAioImpressions,
      timeseries,
    };
  }

  async getTopDomains(workspaceId: string, limit: number = 50): Promise<any> {
    const citations = await this.prisma.citation.findMany({
      where: {
        answer: {
          promptRun: {
            workspaceId,
          },
        },
      },
      include: {
        answer: {
          include: {
            promptRun: {
              include: {
                engine: true,
              },
            },
          },
        },
      },
    });

    // Group by domain
    const domainMap = new Map<string, any>();
    
    for (const citation of citations) {
      const domain = citation.domain;
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          appearances: 0,
          engines: new Set(),
          lastSeen: citation.answer.createdAt,
          competitorOnly: false, // This would be determined by business logic
        });
      }
      
      const domainData = domainMap.get(domain);
      domainData.appearances++;
      domainData.engines.add(citation.answer.promptRun.engine.key);
      if (citation.answer.createdAt > domainData.lastSeen) {
        domainData.lastSeen = citation.answer.createdAt;
      }
    }

    // Convert to array and sort
    const domains = Array.from(domainMap.values())
      .map((d: any) => ({
        ...d,
        engines: Array.from(d.engines),
        lastSeen: d.lastSeen.toISOString(),
      }))
      .sort((a: any, b: any) => b.appearances - a.appearances)
      .slice(0, limit);

    return domains;
  }
}
