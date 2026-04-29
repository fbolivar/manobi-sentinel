import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { EMAIL_QUEUE, EmailQueueProcessor } from './email-queue.processor';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplatesService } from './email-templates.service';
import { EmailAdminController } from './email-admin.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Parque, SuscripcionNotificacion]),
    RedisModule,
    HttpModule.register({ timeout: 5000 }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('redis.host'),
          port: cfg.get<number>('redis.port'),
          password: cfg.get<string>('redis.password') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  controllers: [SuscripcionesController, PushController, EmailAdminController],
  providers: [
    NotificacionesService,
    AlertListenerService,
    SuscripcionesService,
    PushService,
    EmailQueueProcessor,
    EmailQueueService,
    EmailTemplatesService,
  ],
  exports: [
    NotificacionesService,
    SuscripcionesService,
    PushService,
    EmailQueueService,
    EmailTemplatesService,
  ],
})
export class NotificacionesModule {}
