import * as ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Alerta } from '../../common/entities/alerta.entity';

export async function alertasToXlsx(alertas: (Alerta & { parque?: { nombre?: string } | null })[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Manobi Sentinel';
  wb.created = new Date();

  const ws = wb.addWorksheet('Alertas', {
    headerFooter: { oddFooter: '&L&8Manobi Sentinel - PNN Colombia&C&8Monitoreo Ambiental&R&8Pag. &P de &N' },
  });

  try {
    const b64 = readFileSync(join(__dirname, 'logo-base64.txt'), 'utf-8').trim();
    const imgBuf = Buffer.from(b64, 'base64');
    const imgId = wb.addImage({ buffer: imgBuf as any, extension: 'png' });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  } catch { /* logo not available */ }

  ws.mergeCells('B1:H1');
  ws.getCell('B1').value = 'Manobi Sentinel - Reporte de Alertas';
  ws.getCell('B1').font = { bold: true, size: 16, color: { argb: 'FF004880' } };
  ws.getCell('B1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 35;

  ws.mergeCells('B2:H2');
  ws.getCell('B2').value = 'Parques Nacionales Naturales de Colombia - ' + new Date().toLocaleString('es-CO');
  ws.getCell('B2').font = { size: 10, color: { argb: 'FF6B7280' } };
  ws.getRow(2).height = 20;

  ws.getRow(3).height = 8;

  const rojos = alertas.filter(a => a.nivel === 'rojo').length;
  const amarillos = alertas.filter(a => a.nivel === 'amarillo').length;
  const verdes = alertas.filter(a => a.nivel === 'verde').length;
  ws.getCell('B4').value = 'ROJO'; ws.getCell('C4').value = rojos;
  ws.getCell('D4').value = 'AMARILLO'; ws.getCell('E4').value = amarillos;
  ws.getCell('F4').value = 'VERDE'; ws.getCell('G4').value = verdes;
  ws.getCell('H4').value = 'TOTAL: ' + alertas.length;
  ['B4','D4','F4'].forEach(c => { ws.getCell(c).font = { bold: true, size: 9, color: { argb: 'FF6B7280' } }; });
  ws.getCell('C4').font = { bold: true, size: 14, color: { argb: 'FFE53935' } };
  ws.getCell('E4').font = { bold: true, size: 14, color: { argb: 'FFD97706' } };
  ws.getCell('G4').font = { bold: true, size: 14, color: { argb: 'FF16A34A' } };
  ws.getCell('H4').font = { bold: true, size: 10, color: { argb: 'FF004880' } };
  ws.getRow(4).height = 28;
  ws.getRow(5).height = 6;

  ws.columns = [
    { key: 'n', width: 6 }, { key: 'tipo', width: 35 }, { key: 'nivel', width: 12 },
    { key: 'estado', width: 12 }, { key: 'parque', width: 35 }, { key: 'fecha_inicio', width: 22 },
    { key: 'fecha_fin', width: 22 }, { key: 'generada_por', width: 16 },
  ];

  const hRow = 6;
  const headers = ['#', 'Tipo', 'Nivel', 'Estado', 'Parque', 'Fecha inicio', 'Fecha fin', 'Origen'];
  const hr = ws.getRow(hRow);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; });
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004880' } };
  hr.alignment = { vertical: 'middle' };
  hr.height = 24;

  alertas.forEach((a, i) => {
    const r = ws.getRow(hRow + 1 + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = a.tipo;
    r.getCell(3).value = a.nivel.toUpperCase();
    r.getCell(4).value = a.estado;
    r.getCell(5).value = a.parque?.nombre || '';
    r.getCell(6).value = a.fecha_inicio instanceof Date ? a.fecha_inicio.toLocaleString('es-CO') : String(a.fecha_inicio || '');
    r.getCell(7).value = a.fecha_fin instanceof Date ? a.fecha_fin.toLocaleString('es-CO') : '';
    r.getCell(8).value = a.generada_por || '';

    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    r.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      cell.font = { size: 10 };
    });

    const nc = a.nivel === 'rojo' ? 'FFE53935' : a.nivel === 'amarillo' ? 'FFD97706' : 'FF16A34A';
    const nbg = a.nivel === 'rojo' ? 'FFFEF2F2' : a.nivel === 'amarillo' ? 'FFFFFBEB' : 'FFF0FDF4';
    const nivelCell = r.getCell(3);
    nivelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nbg } };
    nivelCell.font = { bold: true, size: 10, color: { argb: nc } };
    nivelCell.alignment = { horizontal: 'center' };
  });

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
