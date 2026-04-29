import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parque } from '../common/entities/parque.entity';
import { EventosModule } from '../eventos-climaticos/eventos.module';
import { AlertasModule } from '../alertas/alertas.module';
import { HotspotsController } from './hotspots.controller';
import { HotspotsService } from './hotspots.service';
import { NasaFirmsService } from './nasa-firms.service';
import { OroraTechService } from './ororatech.service';

@Module({
  imports: [
    HttpModule.register({ timeout: 30_000 }),
    TypeOrmModule.forFeature([Parque]),
    EventosModule,
    AlertasModule,
  ],
  controllers: [HotspotsController],
  providers: [HotspotsService, NasaFirmsService, OroraTechService],
  exports: [HotspotsService],
})
export class HotspotsModule {}
