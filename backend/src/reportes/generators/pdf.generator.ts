import puppeteer from 'puppeteer-core';
import { Alerta } from '../../common/entities/alerta.entity';

function row(a: Alerta & { parque?: { nombre?: string } | null }) {
  const color = a.nivel === 'rojo' ? '#ff3b3b' : a.nivel === 'amarillo' ? '#ffb020' : '#00ff88';
  const fechaIni = a.fecha_inicio instanceof Date ? a.fecha_inicio.toISOString() : String(a.fecha_inicio ?? '');
  return `<tr>
    <td>${a.tipo}</td>
    <td><span class="chip" style="background:${color}33;border:1px solid ${color};color:${color}">${a.nivel.toUpperCase()}</span></td>
    <td>${a.parque?.nombre ?? '—'}</td>
    <td>${fechaIni}</td>
    <td>${a.estado}</td>
    <td>${a.generada_por ?? ''}</td>
  </tr>`;
}

export async function alertasToPdf(
  alertas: (Alerta & { parque?: { nombre?: string } | null })[],
  titulo = 'Reporte de Alertas',
): Promise<Buffer> {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: -apple-system, "Segoe UI", sans-serif; color:#0a0e1a; padding:24px; }
    h1 { margin:0 0 4px 0; color:#0a0e1a; }
    .meta { color:#64748b; font-size:12px; }
    table { width:100%; border-collapse: collapse; margin-top:16px; font-size:12px; }
    th, td { padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:left; }
    th { background:#0a0e1a; color:#fff; text-transform:uppercase; font-size:10px; letter-spacing:1px; }
    .chip { padding:2px 8px; border-radius:4px; font-weight:bold; font-size:10px; }
    footer { margin-top:30px; font-size:10px; color:#94a3b8; }
  </style></head><body>
    <h1>${titulo}</h1>
    <div class="meta">Manobi Sentinel · PNN Colombia · Generado ${new Date().toLocaleString('es-CO')}</div>
    <table>
      <thead><tr><th>Tipo</th><th>Nivel</th><th>Parque</th><th>Inicio</th><th>Estado</th><th>Origen</th></tr></thead>
      <tbody>${alertas.map(row).join('')}</tbody>
    </table>
    <footer>Total de alertas: ${alertas.length} · Sistema gubernamental monitoreado.</footer>
  </body></html>`;

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
