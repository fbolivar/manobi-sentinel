import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client as MinioClient } from 'minio';
import { Between, In, Repository } from 'typeorm';
import { Alerta } from '../common/entities/alerta.entity';
import { Reporte } from '../common/entities/reporte.entity';
import { MINIO_CLIENT } from './minio.provider';
import { alertasToCsv } from './generators/csv.generator';
import { alertasToXlsx } from './generators/xlsx.generator';
import { alertasToPdf } from './generators/pdf.generator';

export interface ReportParams {
  desde?: string;
  hasta?: string;
  niveles?: ('verde' | 'amarillo' | 'rojo')[];
  parque_id?: string;
}

@Injectable()
export class ReportesService {
  private readonly log = new Logger('Reportes');

  constructor(
    @InjectRepository(Reporte) private readonly repo: Repository<Reporte>,
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
    @Inject(MINIO_CLIENT) private readonly minio: MinioClient,
    private readonly cfg: ConfigService,
  ) {}

  findAll() { return this.repo.find({ order: { creado_en: 'DESC' }, take: 100 }); }

  async findOne(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Reporte no encontrado');
    return r;
  }

  async remove(id: string) {
    const r = await this.findOne(id);
    if (r.ruta_minio) {
      const bucket = this.cfg.get<string>('minio.bucketReportes')!;
      try { await this.minio.removeObject(bucket, r.ruta_minio); } catch {}
    }
    await this.repo.remove(r);
    this.log.log(`Reporte eliminado: ${id}`);
    return { ok: true };
  }

  async presignedUrl(id: string): Promise<string> {
    const r = await this.findOne(id);
    if (!r.ruta_minio) throw new NotFoundException('Reporte sin archivo');
    const bucket = this.cfg.get<string>('minio.bucketReportes')!;
    return this.minio.presignedGetObject(bucket, r.ruta_minio, 60 * 60);
  }

  async downloadStream(id: string) {
    const r = await this.findOne(id);
    if (!r.ruta_minio) throw new NotFoundException('Reporte sin archivo');
    const bucket = this.cfg.get<string>('minio.bucketReportes')!;
    const stream = await this.minio.getObject(bucket, r.ruta_minio);
    const ext = r.formato;
    const contentType =
      ext === 'pdf' ? 'application/pdf'
      : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';
    return { stream, filename: r.ruta_minio, contentType };
  }

  async generar(
    tipo: string,
    formato: 'pdf' | 'xlsx' | 'csv',
    usuarioId: string,
    params: ReportParams,
  ): Promise<Reporte> {
    const where: Record<string, unknown> = {};
    if (params.desde && params.hasta) where!['fecha_inicio'] = Between(new Date(params.desde), new Date(params.hasta));
    if (params.niveles?.length) where!['nivel'] = In(params.niveles);
    if (params.parque_id) where!['parque_id'] = params.parque_id;

    const alertas = await this.alertas.find({
      where, relations: { parque: true },
      order: { fecha_inicio: 'DESC' }, take: 2000,
    });

    let buf: Buffer; let ext: string; let contentType: string;
    if (formato === 'csv')       { buf = alertasToCsv(alertas); ext = 'csv'; contentType = 'text/csv'; }
    else if (formato === 'xlsx') { buf = await alertasToXlsx(alertas); ext = 'xlsx';
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; }
    else                         { buf = await alertasToPdf(alertas, tipo); ext = 'pdf'; contentType = 'application/pdf'; }

    const bucket = this.cfg.get<string>('minio.bucketReportes')!;
    const objectName = `${tipo.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.${ext}`;
    await this.minio.putObject(bucket, objectName, buf, buf.length, { 'Content-Type': contentType });

    const saved = await this.repo.save({
      tipo, formato, generado_por: usuarioId,
      parametros: params as unknown as Record<string, unknown>,
      ruta_minio: objectName,
    });
    this.log.log(`Reporte ${formato} generado: ${bucket}/${objectName} (${buf.length} bytes, ${alertas.length} alertas)`);
    return saved;
  }
}
