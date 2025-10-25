import { Module } from '@nestjs/common';
import { EnginesController } from './engines.controller';
import { EnginesService } from './engines.service';

@Module({
  providers: [EnginesService],
  controllers: [EnginesController],
})
export class EnginesModule {}
