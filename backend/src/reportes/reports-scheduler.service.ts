import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Client as MinioClient } from 'minio';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MINIO_CLIENT } from './minio.provider';
import { ReportesService } from './reportes.service';

const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class ReportsSchedulerService {
  private readonly log = new Logger('ReportsScheduler');

  constructor(
    private readonly reportes: ReportesService,
    private readonly notif: NotificacionesService,
    private readonly cfg: ConfigService,
    @Inject(MINIO_CLIENT) private readonly minio: MinioClient,
  ) {}

  /** Resumen diario 6:00 AM hora Colombia (del día anterior). */
  @Cron('0 0 6 * * *', { name: 'report-daily', timeZone: 'America/Bogota' })
  async daily() {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 24 * 3600 * 1000);
    const r = await this.reportes.generar('Resumen diario', 'pdf', SYSTEM_USER, {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
    });
    await this.emailReporte(r.id, r.ruta_minio!, 'Resumen diario de alertas');
    this.log.log(`Reporte diario generado y enviado: ${r.ruta_minio}`);
  }

  /** Informe semanal lunes 7:00 AM hora Colombia (últimos 7 días). */
  @Cron('0 0 7 * * 1', { name: 'report-weekly', timeZone: 'America/Bogota' })
  async weekly() {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 7 * 24 * 3600 * 1000);
    const r = await this.reportes.generar('Informe semanal', 'pdf', SYSTEM_USER, {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
    });
    await this.emailReporte(r.id, r.ruta_minio!, 'Informe semanal de alertas');
    this.log.log(`Reporte semanal generado y enviado: ${r.ruta_minio}`);
  }

  private async emailReporte(id: string, objectName: string, subject: string) {
    const ops = this.cfg.get<string[]>('notify.emailOperadores') ?? [];
    if (ops.length === 0) { this.log.warn('Sin operadores configurados'); return; }

    const publicUrl = this.cfg.get<string>('PUBLIC_URL') ?? '';
    const downloadUrl = `${publicUrl}/api/reportes/${id}/download`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;background:#0a0e1a;color:#fff;padding:24px;border-radius:8px">
        <h2 style="margin:0;color:#00bfff">${subject}</h2>
        <p style="color:#cbd5e1">El reporte se ha generado automáticamente y está disponible para descarga.</p>
        <p style="margin-top:20px"><a style="background:#00ff88;color:#0a0e1a;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:bold" href="${downloadUrl}">DESCARGAR REPORTE (PDF)</a></p>
        <p style="color:#64748b;font-size:11px;margin-top:30px">Archivo: ${objectName}<br>Sistema gubernamental monitoreado · Manobi Sentinel</p>
      </div>`;
    await this.notif.enviarEmail(ops, `[Manobi Sentinel] ${subject}`, html);
  }
}
