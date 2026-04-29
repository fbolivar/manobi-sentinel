import { Controller, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule, HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';

import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule, REDIS_CLIENT } from './redis/redis.module';
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
import { BackupsModule } from './backups/backups.module';
import { Usuario } from './common/entities/usuario.entity';
import { SeedAdminService } from './bootstrap/seed-admin';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
class HealthController {
  constructor(
    private readonly ds: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly http: HttpService,
    private readonly cfg: ConfigService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, red, ia] = await Promise.allSettled([
      this.ds.query('SELECT 1'),
      this.redis.ping(),
      firstValueFrom(
        this.http.get('/health', {
          baseURL: this.cfg.get<string>('ia.baseUrl') ?? 'http://manobi-ia:8000',
          timeout: 3000,
        }),
      ),
    ]);

    return {
      status: 'ok',
      service: 'manobi-api',
      ts: new Date().toISOString(),
      checks: {
        db: db.status === 'fulfilled' ? 'ok' : 'error',
        redis: red.status === 'fulfilled' ? 'ok' : 'error',
        ia: ia.status === 'fulfilled' ? 'ok' : 'error',
      },
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    CommonModule,
    HttpModule,
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
    BackupsModule,
  ],
  controllers: [HealthController],
  providers: [
    SeedAdminService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
