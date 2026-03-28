import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdditionalRequestsController } from './additional-requests.controller';
import { AdditionalRequestsService } from './additional-requests.service';
import { AdditionalRequestsRepository } from './additional-requests.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AdditionalRequestsController],
  providers: [AdditionalRequestsService, AdditionalRequestsRepository],
  exports: [AdditionalRequestsService],
})
export class AdditionalRequestsModule {}
