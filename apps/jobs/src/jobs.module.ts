import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnhancedQueueService } from './services/enhanced-queue.service';
import { JobRetryService } from './services/job-retry.service';
import { JobDeduplicationService } from './services/job-deduplication.service';
import { QueueMonitoringService } from './services/queue-monitoring.service';
import { EnhancedWorkerBase } from './services/enhanced-worker.base';

@Module({
  imports: [ConfigModule],
  providers: [
    EnhancedQueueService,
    JobRetryService,
    JobDeduplicationService,
    QueueMonitoringService,
    EnhancedWorkerBase,
  ],
  exports: [
    EnhancedQueueService,
    JobRetryService,
    JobDeduplicationService,
    QueueMonitoringService,
    EnhancedWorkerBase,
  ],
})
export class JobsModule {}

