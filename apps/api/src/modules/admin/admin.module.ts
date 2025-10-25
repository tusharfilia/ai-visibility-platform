import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
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
  controllers: [AdminController],
})
export class AdminModule {}
