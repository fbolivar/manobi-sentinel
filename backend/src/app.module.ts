import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ParquesModule } from './parques/parques.module';
import { EventosModule } from './eventos-climaticos/eventos.module';
import { AlertasModule } from './alertas/alertas.module';
import { PrediccionesModule } from './predicciones/predicciones.module';
import { IdeamModule } from './ideam/ideam.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ReportesModule } from './reportes/reportes.module';
import { MetricsModule } from './metrics/metrics.module';
import { HotspotsModule } from './hotspots/hotspots.module';
import { Usuario } from './common/entities/usuario.entity';
import { SeedAdminService } from './bootstrap/seed-admin';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  check() { return { status: 'ok', service: 'manobi-api', ts: new Date().toISOString() }; }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    CommonModule,
    TypeOrmModule.forFeature([Usuario]),
    AuthModule,
    UsersModule,
    ParquesModule,
    EventosModule,
    AlertasModule,
    PrediccionesModule,
    IdeamModule,
    NotificacionesModule,
    ReportesModule,
    MetricsModule,
    HotspotsModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedAdminService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
