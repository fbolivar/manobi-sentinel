import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos-climaticos/eventos.module';
import { IdeamController } from './ideam.controller';
import { IdeamService } from './ideam.service';

@Module({
  imports: [EventosModule, HttpModule.register({ timeout: 30_000 })],
  controllers: [IdeamController],
  providers: [IdeamService],
  exports: [IdeamService],
})
export class IdeamModule {}
