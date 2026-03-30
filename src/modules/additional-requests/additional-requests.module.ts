import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdditionalRequestsController } from './additional-requests.controller';
import { AdditionalRequestsService } from './additional-requests.service';
import { AdditionalRequestsRepository } from './additional-requests.repository';
import { AdditionalRequestItem } from './entities/additional-request-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdditionalRequestItem])],
  controllers: [AdditionalRequestsController],
  providers: [AdditionalRequestsService, AdditionalRequestsRepository],
  exports: [AdditionalRequestsService],
})
export class AdditionalRequestsModule {}
