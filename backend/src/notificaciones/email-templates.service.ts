import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NivelAlerta = 'verde' | 'amarillo' | 'rojo';

export interface AlertaEmailData {
  id: string;
  tipo: string;
  nivel: NivelAlerta;
  descripcion?: string | null;
  parque_id?: string | null;
  fecha_inicio?: string;
}

export interface AlertaResumenItem {
  tipo: string;
  nivel: NivelAlerta;
  parqueNombre?: string;
  descripcion?: string | null;
  fecha: string;
}

const BRAND = {
  bg: '#0a0e1a',
  card: '#1e293b',
  border: '#2d3748',
  muted: '#64748b',
  text: '#e2e8f0',
  label: '#94a3b8',
  logo: 'Manobi Sentinel',
  org: 'Parques Nacionales Naturales de Colombia',
};

const NIVEL_COLOR: Record<NivelAlerta, string> = {
  rojo: '#ff3b3b',
  amarillo: '#ffb020',
  verde: '#00ff88',
};

const NIVEL_EMOJI: Record<NivelAlerta, string> = {
  rojo: '🔴',
  amarillo: '🟡',
  verde: '🟢',
};

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${BRAND.logo}</title>
</head>
<body style="margin:0;padding:16px;background:#060912;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:${BRAND.bg};border-radius:10px;overflow:hidden;border:1px solid ${BRAND.border}">
    <div style="background:#0f172a;padding:14px 24px;display:flex;align-items:center;gap:10px;border-bottom:1px solid ${BRAND.border}">
      <span style="font-size:20px">🛡️</span>
      <span style="color:#00bfff;font-weight:bold;font-size:15px">${BRAND.logo}</span>
      <span style="color:${BRAND.muted};font-size:12px;margin-left:auto">${BRAND.org}</span>
    </div>
    <div style="padding:24px">
      ${content}
    </div>
    <div style="background:#060912;padding:14px 24px;border-top:1px solid ${BRAND.border}">
      <p style="margin:0;color:${BRAND.muted};font-size:11px;text-align:center">
        Sistema de alerta temprana on-premise · ${BRAND.org}<br>
        Este mensaje fue generado automáticamente. No responder a este correo.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;color:${BRAND.label};font-size:13px;width:110px;vertical-align:top">${label}</td>
    <td style="padding:7px 0;color:${BRAND.text};font-size:13px">${value}</td>
  </tr>`;
}

function btn(href: string, label: string, color: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:${color};color:#0a0e1a;text-decoration:none;font-weight:bold;border-radius:6px;font-size:13px">${label}</a>`;
}

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly cfg: ConfigService) {}

  private get publicUrl(): string {
    return this.cfg.get<string>('PUBLIC_URL') ?? 'http://localhost';
  }

  /** Alerta climática individual */
  alerta(a: AlertaEmailData, parqueNombre?: string): { subject: string; html: string } {
    const color = NIVEL_COLOR[a.nivel];
    const emoji = NIVEL_EMOJI[a.nivel];
    const subject = `[Manobi Sentinel] Alerta ${a.nivel.toUpperCase()} — ${a.tipo}`;
    const fechaStr = a.fecha_inicio
      ? new Date(a.fecha_inicio).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
      : new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    const html = layout(`
      <h2 style="margin:0 0 4px;color:${color};font-size:20px">${emoji} ALERTA ${a.nivel.toUpperCase()}</h2>
      <p style="margin:0 0 16px;color:${BRAND.label};font-size:12px">Sistema de alerta temprana · ${BRAND.org}</p>
      <div style="background:${BRAND.card};border-radius:8px;padding:16px;border-left:4px solid ${color}">
        <table style="width:100%;border-collapse:collapse">
          ${row('Tipo', `<b>${a.tipo}</b>`)}
          ${row('Nivel', `<span style="color:${color};font-weight:bold">${a.nivel.toUpperCase()}</span>`)}
          ${parqueNombre ? row('Parque', `<b>${parqueNombre}</b>`) : ''}
          ${a.descripcion ? row('Acción', a.descripcion) : ''}
          ${row('Detectada', fechaStr)}
          ${row('ID alerta', `<code style="font-size:11px;color:${BRAND.muted}">${a.id}</code>`)}
        </table>
      </div>
      ${btn(`${this.publicUrl}/dashboard`, 'Ver en Dashboard →', color)}
    `);
    return { subject, html };
  }

  /** Digest/resumen de múltiples alertas (p.ej. reporte diario de novedades) */
  digest(
    alertas: AlertaResumenItem[],
    fechaDesde: Date,
    fechaHasta: Date,
  ): { subject: string; html: string } {
    const total = alertas.length;
    const rojas = alertas.filter((a) => a.nivel === 'rojo').length;
    const amarillas = alertas.filter((a) => a.nivel === 'amarillo').length;
    const verdes = alertas.filter((a) => a.nivel === 'verde').length;
    const subject = `[Manobi Sentinel] Resumen de alertas — ${fechaHasta.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`;

    const filas = alertas
      .map((a) => {
        const c = NIVEL_COLOR[a.nivel];
        return `<tr style="border-bottom:1px solid ${BRAND.border}">
          <td style="padding:8px 6px;font-size:12px;color:${c};font-weight:bold">${a.nivel.toUpperCase()}</td>
          <td style="padding:8px 6px;font-size:12px;color:${BRAND.text}">${a.tipo}</td>
          <td style="padding:8px 6px;font-size:12px;color:${BRAND.label}">${a.parqueNombre ?? '—'}</td>
          <td style="padding:8px 6px;font-size:11px;color:${BRAND.muted}">${new Date(a.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
        </tr>`;
      })
      .join('');

    const html = layout(`
      <h2 style="margin:0 0 4px;color:#00bfff;font-size:18px">📊 Resumen de Alertas</h2>
      <p style="margin:0 0 16px;color:${BRAND.label};font-size:12px">
        Período: ${fechaDesde.toLocaleString('es-CO', { timeZone: 'America/Bogota' })} →
        ${fechaHasta.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
      </p>
      <div style="display:flex;gap:12px;margin-bottom:20px">
        ${[
          { label: 'Total', val: total, c: '#00bfff' },
          { label: 'Rojo', val: rojas, c: NIVEL_COLOR.rojo },
          { label: 'Amarillo', val: amarillas, c: NIVEL_COLOR.amarillo },
          { label: 'Verde', val: verdes, c: NIVEL_COLOR.verde },
        ]
          .map(
            ({ label, val, c }) => `
          <div style="flex:1;background:${BRAND.card};border-radius:8px;padding:12px;text-align:center;border-top:3px solid ${c}">
            <div style="font-size:24px;font-weight:bold;color:${c}">${val}</div>
            <div style="font-size:11px;color:${BRAND.label};margin-top:4px">${label}</div>
          </div>`,
          )
          .join('')}
      </div>
      ${
        total > 0
          ? `<div style="background:${BRAND.card};border-radius:8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#0f172a">
                <th style="padding:8px 6px;font-size:11px;color:${BRAND.label};text-align:left;font-weight:600">NIVEL</th>
                <th style="padding:8px 6px;font-size:11px;color:${BRAND.label};text-align:left;font-weight:600">TIPO</th>
                <th style="padding:8px 6px;font-size:11px;color:${BRAND.label};text-align:left;font-weight:600">PARQUE</th>
                <th style="padding:8px 6px;font-size:11px;color:${BRAND.label};text-align:left;font-weight:600">HORA</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>`
          : `<p style="color:${BRAND.muted};text-align:center;padding:20px 0">Sin alertas en el período</p>`
      }
      ${btn(`${this.publicUrl}/dashboard`, 'Ver Dashboard →', '#00bfff')}
    `);
    return { subject, html };
  }

  /** Entrega de reporte generado (PDF/XLSX/CSV) */
  reporte(
    reporteId: string,
    nombreArchivo: string,
    titulo: string,
  ): { subject: string; html: string } {
    const subject = `[Manobi Sentinel] ${titulo}`;
    const downloadUrl = `${this.publicUrl}/api/reportes/${reporteId}/download`;

    const html = layout(`
      <h2 style="margin:0 0 4px;color:#00bfff;font-size:18px">📄 ${titulo}</h2>
      <p style="margin:0 0 16px;color:${BRAND.label};font-size:13px">
        El reporte se ha generado automáticamente y está disponible para descarga.
      </p>
      <div style="background:${BRAND.card};border-radius:8px;padding:16px">
        <table style="width:100%;border-collapse:collapse">
          ${row('Archivo', `<code style="font-size:11px">${nombreArchivo}</code>`)}
          ${row('Generado', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }))}
          ${row('Disponible', 'Inmediato (enlace válido 7 días)')}
        </table>
      </div>
      ${btn(downloadUrl, 'Descargar Reporte →', '#00bfff')}
    `);
    return { subject, html };
  }

  /** Bienvenida para usuario nuevo */
  bienvenida(
    nombre: string,
    email: string,
    rol: string,
    passwordTemporal?: string,
  ): { subject: string; html: string } {
    const subject = `[Manobi Sentinel] Bienvenido al sistema — ${nombre}`;

    const html = layout(`
      <h2 style="margin:0 0 4px;color:#00ff88;font-size:18px">👋 ¡Bienvenido, ${nombre}!</h2>
      <p style="margin:0 0 16px;color:${BRAND.label};font-size:13px">
        Tu cuenta ha sido creada en el Sistema de Alerta Temprana Manobi Sentinel.
      </p>
      <div style="background:${BRAND.card};border-radius:8px;padding:16px;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse">
          ${row('Email', email)}
          ${row('Rol', `<span style="color:#00bfff;font-weight:bold">${rol}</span>`)}
          ${passwordTemporal ? row('Contraseña temporal', `<code style="background:#0f172a;padding:2px 6px;border-radius:3px;font-size:12px">${passwordTemporal}</code>`) : ''}
        </table>
      </div>
      ${passwordTemporal ? `<p style="color:${NIVEL_COLOR.amarillo};font-size:12px;margin:0 0 16px">⚠ Cambia tu contraseña al primer inicio de sesión.</p>` : ''}
      ${btn(`${this.publicUrl}/login`, 'Iniciar Sesión →', '#00ff88')}
    `);
    return { subject, html };
  }

  /** Email de prueba para verificar la configuración SMTP */
  prueba(destinatario: string): { subject: string; html: string } {
    const subject = '[Manobi Sentinel] Email de prueba — configuración SMTP OK';
    const ahora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    const html = layout(`
      <h2 style="margin:0 0 4px;color:#00ff88;font-size:18px">✅ Configuración SMTP verificada</h2>
      <p style="margin:0 0 16px;color:${BRAND.label};font-size:13px">
        Este mensaje confirma que el servidor de correo está configurado correctamente.
      </p>
      <div style="background:${BRAND.card};border-radius:8px;padding:16px">
        <table style="width:100%;border-collapse:collapse">
          ${row('Destinatario', destinatario)}
          ${row('Enviado a las', ahora)}
          ${row('Servidor', 'Postfix → SMTP relay')}
          ${row('Estado', '<span style="color:#00ff88;font-weight:bold">✓ Operativo</span>')}
        </table>
      </div>
      <p style="color:${BRAND.muted};font-size:12px;margin-top:16px">
        Si recibes este mensaje, las alertas por correo electrónico funcionarán correctamente.
      </p>
    `);
    return { subject, html };
  }
}
