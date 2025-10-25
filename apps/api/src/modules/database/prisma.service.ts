/**
 * Database service using raw PostgreSQL queries
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  async onModuleInit() {
    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  // Raw query method
  async $queryRaw<T = any>(query: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Mock Prisma methods for compatibility
  get user() {
    return {
      findUnique: async (args: any) => {
        const result = await this.$queryRaw('SELECT * FROM "User" WHERE id = $1', [args.where.id]);
        return result[0] || null;
      }
    };
  }

  get workspaceMember() {
    return {
      findMany: async (args: any) => {
        const result = await this.$queryRaw('SELECT * FROM "WorkspaceMember" WHERE "userId" = $1', [args.where.userId]);
        return result;
      }
    };
  }

  get metricDaily() {
    return {
      findMany: async (args: any) => {
        const result = await this.$queryRaw('SELECT * FROM "MetricDaily" WHERE "workspaceId" = $1', [args.where.workspaceId]);
        return result;
      }
    };
  }

  get citation() {
    return {
      findMany: async (args: any) => {
        const result = await this.$queryRaw('SELECT * FROM "Citation" WHERE "answerId" IN (SELECT id FROM "Answer" WHERE "promptRunId" IN (SELECT id FROM "PromptRun" WHERE "workspaceId" = $1))', [args.where.answer.promptRun.workspaceId]);
        return result;
      }
    };
  }
}
