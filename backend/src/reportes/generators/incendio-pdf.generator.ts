import puppeteer from 'puppeteer-core';

export interface EntradaCronologica {
  fecha: string;
  focos?: number;
  texto: string;
}

export interface IncendioReporteParams {
  numero_seguimiento: number;
  fecha_reporte: string;
  area_protegida: string;
  municipio_departamento: string;
  estado_actual: string;
  elaborado_por: string;
  cobertura_ha?: number;
  cobertura_descripcion: string;
  reportes_campo: EntradaCronologica[];
  notas?: string;
  monitoreo_satelital: EntradaCronologica[];
  intervenciones: EntradaCronologica[];
  fauna_afectada?: string;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function entradas(items: EntradaCronologica[]): string {
  if (!items.length) return '<p class="vacio">Sin registros.</p>';
  return items.map((e) => `
    <div class="entrada">
      <div class="entrada-fecha">${fmtFecha(e.fecha)}${e.focos != null ? ` · <strong>${e.focos} focos de calor</strong>` : ''}</div>
      <p>${e.texto.replace(/\n/g, '<br>')}</p>
    </div>
  `).join('');
}

function estadoChip(estado: string): string {
  const lower = estado.toLowerCase();
  const color =
    lower.includes('activo') ? '#ef4444'
    : lower.includes('control') ? '#f59e0b'
    : lower.includes('extingui') || lower.includes('liquida') ? '#22c55e'
    : '#64748b';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${color}22;border:1px solid ${color};color:${color};font-weight:600;font-size:11px">${estado}</span>`;
}

export async function incendioToPdf(params: IncendioReporteParams): Promise<Buffer> {
  const generadoEn = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const numStr = String(params.numero_seguimiento).padStart(3, '0');
  const titulo = `Seguimiento ${numStr} · Incendio Forestal · ${fmtFecha(params.fecha_reporte)}`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; }

  /* Encabezado */
  .header { background: #0a2540; color: #fff; padding: 16px 24px; display: flex; align-items: center; gap: 16px; }
  .header-logo { width: 48px; height: 48px; background: #16a34a; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .header-text {}
  .header-title { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; color: #fff; }
  .header-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .header-badge { margin-left: auto; text-align: right; }
  .badge { display: inline-block; background: #16a34a22; border: 1px solid #16a34a; color: #4ade80;
    font-size: 10px; padding: 3px 10px; border-radius: 999px; font-weight: 600; }

  /* Ficha */
  .ficha { margin: 16px 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .ficha-title { background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    padding: 8px 14px; font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
  .ficha-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .ficha-row { display: contents; }
  .ficha-cell { padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }
  .ficha-cell:nth-child(odd) { border-right: 1px solid #f1f5f9; }
  .ficha-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }
  .ficha-value { font-size: 11px; color: #1e293b; margin-top: 2px; line-height: 1.4; }
  .ficha-full { grid-column: 1 / -1; }

  /* Cobertura badge */
  .cobertura-box { margin: 0 24px 16px; background: #fff7ed; border: 1px solid #fed7aa;
    border-radius: 8px; padding: 10px 14px; display: flex; align-items: flex-start; gap: 12px; }
  .cobertura-ha { font-size: 28px; font-weight: 800; color: #c2410c; line-height: 1; }
  .cobertura-ha-label { font-size: 9px; color: #9a3412; text-transform: uppercase; font-weight: 700; }
  .cobertura-desc { font-size: 11px; color: #7c3d1d; margin-top: 3px; }

  /* Secciones */
  .section { margin: 0 24px 16px; }
  .section-header { background: #0a2540; color: #fff; padding: 7px 14px;
    border-radius: 6px 6px 0 0; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .section-body { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 6px 6px; padding: 12px 14px; }

  .entrada { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
  .entrada:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .entrada-fecha { font-size: 10px; font-weight: 700; color: #0a2540;
    text-transform: capitalize; margin-bottom: 4px; }
  .entrada p { line-height: 1.6; color: #334155; }

  .notas-box { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px;
    margin: 8px 0 0; border-radius: 0 4px 4px 0; }
  .notas-label { font-size: 9px; font-weight: 700; color: #92400e; text-transform: uppercase; margin-bottom: 3px; }
  .notas-box p { color: #78350f; line-height: 1.5; }

  .vacio { color: #94a3b8; font-style: italic; }

  /* Footer */
  .footer { margin: 20px 24px 0; border-top: 1px solid #e2e8f0;
    padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 9px; color: #94a3b8; }
  .footer-right { font-size: 9px; color: #94a3b8; text-align: right; }
</style>
</head><body>

<!-- Encabezado -->
<div class="header">
  <div class="header-logo">🔥</div>
  <div class="header-text">
    <div class="header-title">REPORTE DE INCENDIO FORESTAL</div>
    <div class="header-sub">Sistema Nacional de Áreas Protegidas · PNN Colombia</div>
  </div>
  <div class="header-badge">
    <div class="header-title" style="font-size:13px">SEGUIMIENTO ${numStr}</div>
    <div style="margin-top:4px">${estadoChip(params.estado_actual)}</div>
  </div>
</div>

<!-- Ficha técnica -->
<div class="ficha">
  <div class="ficha-title">Ficha técnica del incidente</div>
  <div class="ficha-grid">
    <div class="ficha-cell">
      <div class="ficha-label">Área protegida</div>
      <div class="ficha-value">${params.area_protegida}</div>
    </div>
    <div class="ficha-cell">
      <div class="ficha-label">Municipio / Departamento</div>
      <div class="ficha-value">${params.municipio_departamento}</div>
    </div>
    <div class="ficha-cell">
      <div class="ficha-label">Estado actual</div>
      <div class="ficha-value">${estadoChip(params.estado_actual)}</div>
    </div>
    <div class="ficha-cell">
      <div class="ficha-label">Fecha del reporte</div>
      <div class="ficha-value">${fmtFecha(params.fecha_reporte)}</div>
    </div>
    <div class="ficha-cell ficha-full">
      <div class="ficha-label">Elaborado por</div>
      <div class="ficha-value">${params.elaborado_por}</div>
    </div>
  </div>
</div>

<!-- Cobertura -->
<div class="cobertura-box">
  ${params.cobertura_ha != null
    ? `<div style="text-align:center;flex-shrink:0">
        <div class="cobertura-ha">${params.cobertura_ha.toLocaleString('es-CO')}</div>
        <div class="cobertura-ha-label">ha afectadas</div>
       </div>`
    : ''
  }
  <div>
    <div class="ficha-label" style="color:#9a3412">Cobertura afectada</div>
    <div class="cobertura-desc">${params.cobertura_descripcion || 'Sin descripción de cobertura.'}</div>
  </div>
</div>

<!-- Últimos reportes de campo -->
<div class="section">
  <div class="section-header">Últimos reportes · Área protegida · Seguimiento ${numStr}</div>
  <div class="section-body">
    ${entradas(params.reportes_campo)}
    ${params.notas ? `
    <div class="notas-box">
      <div class="notas-label">Notas</div>
      <p>${params.notas.replace(/\n/g, '<br>')}</p>
    </div>` : ''}
  </div>
</div>

<!-- Situación monitoreo remoto -->
<div class="section">
  <div class="section-header">Situación de monitoreo remoto</div>
  <div class="section-body">${entradas(params.monitoreo_satelital)}</div>
</div>

<!-- Intervenciones -->
<div class="section">
  <div class="section-header">Intervenciones de control y extinción</div>
  <div class="section-body">${entradas(params.intervenciones)}</div>
</div>

${params.fauna_afectada ? `
<!-- Fauna -->
<div class="section">
  <div class="section-header">Afectaciones en especies de fauna</div>
  <div class="section-body">
    <p style="line-height:1.6;color:#334155">${params.fauna_afectada.replace(/\n/g, '<br>')}</p>
  </div>
</div>` : ''}

<!-- Footer -->
<div class="footer">
  <div class="footer-left">
    Manobi Sentinel · Sistema de Monitoreo PNN Colombia<br>
    Generado: ${generadoEn}
  </div>
  <div class="footer-right">
    Seguimiento ${numStr} — Incendio Forestal<br>
    Uso oficial — Información reservada
  </div>
</div>

</body></html>`;

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '12mm', bottom: '12mm', left: '0', right: '0' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
