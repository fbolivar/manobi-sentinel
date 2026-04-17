import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface AlertaPayload {
  id: string;
  tipo: string;
  nivel: 'verde' | 'amarillo' | 'rojo';
  descripcion?: string | null;
  parque_id?: string | null;
  fecha_inicio?: string;
}

@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly log = new Logger('Notificaciones');
  private transporter!: nodemailer.Transporter;

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.cfg.get<string>('smtp.host'),
      port: this.cfg.get<number>('smtp.port'),
      secure: false, ignoreTLS: true,
    });
  }

  async enviarEmail(to: string | string[], subject: string, html: string, attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>) {
    try {
      const info = await this.transporter.sendMail({
        from: this.cfg.get<string>('smtp.from'),
        to: Array.isArray(to) ? to.join(',') : to,
        subject, html,
        attachments,
      });
      this.log.log(`Email enviado messageId=${info.messageId} to=${to}`);
      return info;
    } catch (e) {
      this.log.warn(`Fallo SMTP: ${(e as Error).message}`);
      return null;
    }
  }

  templateAlerta(a: AlertaPayload, parqueNombre?: string) {
    const color = a.nivel === 'rojo' ? '#ff3b3b' : a.nivel === 'amarillo' ? '#ffb020' : '#00ff88';
    const subject = `[Manobi Sentinel] Alerta ${a.nivel.toUpperCase()} — ${a.tipo}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;background:#0a0e1a;color:#fff;padding:24px;border-radius:8px">
        <h2 style="margin:0;color:${color}">⚠ ALERTA ${a.nivel.toUpperCase()}</h2>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:28px">${a.nivel === 'rojo' ? '🔴' : a.nivel === 'amarillo' ? '🟡' : '🟢'}</span>
          <span style="color:#94a3b8;font-size:13px">Manobi Sentinel — PNN Colombia</span>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:8px 0">
          <table style="width:100%;border-collapse:collapse;color:#e2e8f0;font-size:14px">
            <tr><td style="padding:8px 0;color:#94a3b8;width:110px">Tipo</td><td><b>${a.tipo}</b></td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8">Nivel</td><td style="color:${color};font-weight:bold">${a.nivel.toUpperCase()}</td></tr>
            ${parqueNombre ? `<tr><td style="padding:8px 0;color:#94a3b8">Parque</td><td><b>${parqueNombre}</b></td></tr>` : ''}
            ${a.descripcion ? `<tr><td style="padding:8px 0;color:#94a3b8">Acción</td><td>${a.descripcion}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#94a3b8">Detectada</td><td>${a.fecha_inicio ? new Date(a.fecha_inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : 'ahora'}</td></tr>
          </table>
        </div>
        <a href="${this.cfg.get<string>('PUBLIC_URL') ?? ''}/dashboard" style="display:inline-block;margin-top:12px;padding:10px 24px;background:${color};color:#0a0e1a;text-decoration:none;font-weight:bold;border-radius:6px;font-size:13px">Ver en Dashboard</a>
        <p style="color:#64748b;font-size:11px;margin-top:20px;border-top:1px solid #1e293b;padding-top:12px">Parques Nacionales Naturales de Colombia · Sistema de alerta temprana</p>
      </div>`;
    return { subject, html };
  }
}
