import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parque } from '../common/entities/parque.entity';
import { SuscripcionNotificacion } from '../common/entities/suscripcion.entity';
import { RedisModule } from '../redis/redis.module';
import { NotificacionesService } from './notificaciones.service';
import { AlertListenerService } from './alert-listener.service';
import { SuscripcionesService } from './suscripciones.service';
import { SuscripcionesController } from './suscripciones.controller';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Parque, SuscripcionNotificacion]),
    RedisModule, HttpModule.register({ timeout: 5000 }),
  ],
  controllers: [SuscripcionesController, PushController],
  providers: [NotificacionesService, AlertListenerService, SuscripcionesService, PushService],
  exports: [NotificacionesService, SuscripcionesService, PushService],
})
export class NotificacionesModule {}
