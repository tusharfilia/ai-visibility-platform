import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { QueueManagementController } from './queue-management.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: 'runPrompt' },
      { name: 'runBatch' },
      { name: 'dailyAggregations' },
      { name: 'copilotPlanner' }
    ),
  ],
  providers: [AdminService],
  controllers: [AdminController, QueueManagementController],
})
export class AdminModule {}
