import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos-climaticos/eventos.module';
import { IdeamController } from './ideam.controller';
import { IdeamService } from './ideam.service';
import { FirmsService } from './firms.service';

@Module({
  imports: [EventosModule, HttpModule.register({ timeout: 30_000 })],
  controllers: [IdeamController],
  providers: [IdeamService, FirmsService],
  exports: [IdeamService, FirmsService],
})
export class IdeamModule {}
