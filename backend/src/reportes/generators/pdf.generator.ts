import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Alerta } from '../../common/entities/alerta.entity';

let logoB64 = '';
try { logoB64 = readFileSync(join(__dirname, 'logo-base64.txt'), 'utf-8').trim(); } catch {}

function nivelColor(n: string) {
  return n === 'rojo' ? '#E53935' : n === 'amarillo' ? '#F9A825' : '#85B425';
}

function row(a: Alerta & { parque?: { nombre?: string } | null }, i: number) {
  const c = nivelColor(a.nivel);
  const bg = i % 2 === 0 ? '#fff' : '#F8FAFC';
  const fechaIni = a.fecha_inicio instanceof Date ? a.fecha_inicio.toLocaleString('es-CO') : String(a.fecha_inicio ?? '');
  return `<tr style="background:${bg}">
    <td>${a.tipo}</td>
    <td><span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${c}15;border:1px solid ${c};color:${c};font-weight:700;font-size:10px">${a.nivel.toUpperCase()}</span></td>
    <td>${a.parque?.nombre ?? '—'}</td>
    <td>${fechaIni}</td>
    <td>${a.estado}</td>
    <td style="color:#6B7280">${a.generada_por ?? ''}</td>
  </tr>`;
}

function summaryRow(alertas: (Alerta & { parque?: { nombre?: string } | null })[]) {
  const r = alertas.filter(a => a.nivel === 'rojo').length;
  const am = alertas.filter(a => a.nivel === 'amarillo').length;
  const v = alertas.filter(a => a.nivel === 'verde').length;
  return `<div style="display:flex;gap:16px;margin:16px 0">
    <div style="flex:1;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#E53935">${r}</div>
      <div style="font-size:10px;color:#EF4444;font-weight:600">ROJO</div>
    </div>
    <div style="flex:1;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#D97706">${am}</div>
      <div style="font-size:10px;color:#F59E0B;font-weight:600">AMARILLO</div>
    </div>
    <div style="flex:1;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:#16A34A">${v}</div>
      <div style="font-size:10px;color:#22C55E;font-weight:600">VERDE</div>
    </div>
  </div>`;
}

export async function alertasToPdf(
  alertas: (Alerta & { parque?: { nombre?: string } | null })[],
  titulo = 'Reporte de Alertas',
): Promise<Buffer> {
  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const logoImg = logoB64 ? `<img src="data:image/png;base64,${logoB64}" style="height:50px;width:50px;border-radius:8px" />` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    @page { margin: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#242424; margin:0; padding:0; font-size:12px; }
    .header { background: linear-gradient(135deg, #85B425, #5B8021); color:white; padding:24px 32px; display:flex; align-items:center; gap:16px; }
    .header h1 { margin:0; font-size:20px; font-weight:700; }
    .header .sub { font-size:11px; opacity:0.85; margin-top:2px; }
    .content { padding: 24px 32px; }
    .meta { color:#6B7280; font-size:11px; margin-bottom:16px; display:flex; justify-content:space-between; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th { background:#004880; color:#fff; text-transform:uppercase; font-size:9px; letter-spacing:1px; padding:10px 8px; text-align:left; }
    td { padding:8px; border-bottom:1px solid #E5E7EB; font-size:11px; }
    .footer { position:fixed; bottom:0; left:0; right:0; background:#F8FAFC; border-top:2px solid #85B425; padding:10px 32px; display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#9CA3AF; }
    .footer .brand { color:#5B8021; font-weight:600; }
    .page-number:after { content: counter(page); }
  </style></head><body>
    <div class="header">
      ${logoImg}
      <div>
        <h1>${titulo}</h1>
        <div class="sub">Manobi Sentinel — Sistema de Alerta Temprana Climática</div>
      </div>
    </div>
    <div class="content">
      <div class="meta">
        <span>Parques Nacionales Naturales de Colombia</span>
        <span>Generado: ${now}</span>
      </div>
      ${summaryRow(alertas)}
      <table>
        <thead><tr><th>Tipo</th><th>Nivel</th><th>Parque</th><th>Fecha inicio</th><th>Estado</th><th>Origen</th></tr></thead>
        <tbody>${alertas.map((a, i) => row(a, i)).join('')}</tbody>
      </table>
    </div>
    <div class="footer">
      <div><span class="brand">Manobi Sentinel</span> · PNN Colombia · Monitoreo Ambiental</div>
      <div>Total: ${alertas.length} alertas · Pág. <span class="page-number"></span></div>
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
      margin: { top: '10mm', bottom: '25mm', left: '10mm', right: '10mm' },
      printBackground: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
