import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../common/entities/alerta.entity';
import { Reporte } from '../common/entities/reporte.entity';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ReportsSchedulerService } from './reports-scheduler.service';
import { minioProvider } from './minio.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Reporte, Alerta])],
  controllers: [ReportesController],
  providers: [ReportesService, ReportsSchedulerService, minioProvider],
  exports: [ReportesService],
})
export class ReportesModule {}
