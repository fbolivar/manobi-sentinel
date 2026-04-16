import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Prediccion } from '../common/entities/prediccion.entity';
import { PrediccionesController } from './predicciones.controller';
import { PrediccionesService } from './predicciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prediccion]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        baseURL: cfg.get<string>('ai.url'),
        timeout: 10_000,
      }),
    }),
  ],
  controllers: [PrediccionesController],
  providers: [PrediccionesService],
  exports: [PrediccionesService],
})
export class PrediccionesModule {}
