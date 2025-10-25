import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  providers: [ConnectionsService],
  controllers: [ConnectionsController],
})
export class ConnectionsModule {}
