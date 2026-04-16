import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../common/entities/alerta.entity';
import { ReglaAlerta } from '../common/entities/regla-alerta.entity';
import { Parque } from '../common/entities/parque.entity';
import { Prediccion } from '../common/entities/prediccion.entity';
import { RedisModule } from '../redis/redis.module';
import { EventosModule } from '../eventos-climaticos/eventos.module';
import { PrediccionesModule } from '../predicciones/predicciones.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { AlertEngineService } from './alert-engine.service';
import { AlertsGateway } from './alerts.gateway';
import { ReglasController } from './reglas.controller';
import { ReglasService } from './reglas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta, ReglaAlerta, Parque, Prediccion]),
    RedisModule, EventosModule, PrediccionesModule,
  ],
  controllers: [AlertasController, ReglasController],
  providers: [AlertasService, AlertEngineService, AlertsGateway, ReglasService],
  exports: [AlertasService, AlertsGateway],
})
export class AlertasModule {}
