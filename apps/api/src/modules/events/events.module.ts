import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsController } from './events.controller';
import { EventEmitterService } from './event-emitter.service';
import { SSEConnectionPoolService } from './connection-pool.service';
import { RedisSSEAdapter } from './redis-adapter';
import { WorkspaceContextService } from '../../middleware/workspace-context';

@Module({
  imports: [ConfigModule],
  controllers: [EventsController],
  providers: [
    EventEmitterService,
    SSEConnectionPoolService,
    RedisSSEAdapter,
    WorkspaceContextService,
  ],
  exports: [
    EventEmitterService,
    SSEConnectionPoolService,
    RedisSSEAdapter,
  ],
})
export class EventsModule {}

