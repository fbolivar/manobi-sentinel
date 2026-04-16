import * as ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Alerta } from '../../common/entities/alerta.entity';

export async function alertasToXlsx(alertas: (Alerta & { parque?: { nombre?: string } | null })[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Manobi Sentinel — PNN Colombia';
  wb.created = new Date();
  wb.properties.date1904 = false;

  const ws = wb.addWorksheet('Alertas', {
    headerFooter: {
      oddFooter: '&L&8Manobi Sentinel · PNN Colombia&C&8Monitoreo Ambiental&R&8Pág. &P de &N',
    },
  });

  // Logo
  try {
    const logoPath = join(__dirname, '..', '..', '..', 'public', 'logo.png');
    const imgBuf = readFileSync("/opt/manobi-sentinel/frontend/public/logo.png"); const imgId = wb.addImage({ buffer: Buffer.from(imgBuf) as any, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  } catch {}

  // Header rows
  ws.mergeCells('B1:H1');
  const titleCell = ws.getCell('B1');
  titleCell.value = 'Manobi Sentinel — Reporte de Alertas';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF004880' } };
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 35;

  ws.mergeCells('B2:H2');
  const subCell = ws.getCell('B2');
  subCell.value = 'Parques Nacionales Naturales de Colombia · ' + new Date().toLocaleString('es-CO');
  subCell.font = { size: 10, color: { argb: 'FF6B7280' } };
  ws.getRow(2).height = 20;

  // Summary row
  ws.getRow(3).height = 8;
  const rojos = alertas.filter(a => a.nivel === 'rojo').length;
  const amarillos = alertas.filter(a => a.nivel === 'amarillo').length;
  const verdes = alertas.filter(a => a.nivel === 'verde').length;

  ws.getCell('B4').value = 'ROJO';
  ws.getCell('C4').value = rojos;
  ws.getCell('D4').value = 'AMARILLO';
  ws.getCell('E4').value = amarillos;
  ws.getCell('F4').value = 'VERDE';
  ws.getCell('G4').value = verdes;
  ws.getCell('H4').value = 'TOTAL: ' + alertas.length;
  ['B4','D4','F4'].forEach(c => { ws.getCell(c).font = { bold: true, size: 9, color: { argb: 'FF6B7280' } }; });
  ws.getCell('C4').font = { bold: true, size: 14, color: { argb: 'FFE53935' } };
  ws.getCell('E4').font = { bold: true, size: 14, color: { argb: 'FFD97706' } };
  ws.getCell('G4').font = { bold: true, size: 14, color: { argb: 'FF16A34A' } };
  ws.getCell('H4').font = { bold: true, size: 10, color: { argb: 'FF004880' } };
  ws.getRow(4).height = 28;

  // Spacer
  ws.getRow(5).height = 6;

  // Table header (row 6)
  const headerRow = 6;
  ws.columns = [
    { key: 'id', width: 10 },
    { key: 'tipo', width: 35 },
    { key: 'nivel', width: 12 },
    { key: 'estado', width: 12 },
    { key: 'parque', width: 35 },
    { key: 'fecha_inicio', width: 22 },
    { key: 'fecha_fin', width: 22 },
    { key: 'generada_por', width: 16 },
  ];

  const headers = ['#', 'Tipo', 'Nivel', 'Estado', 'Parque', 'Fecha inicio', 'Fecha fin', 'Generada por'];
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; });
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004880' } };
  hr.alignment = { vertical: 'middle' };
  hr.height = 24;
  hr.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF85B425' } } };
  });

  // Data rows
  alertas.forEach((a, i) => {
    const r = ws.getRow(headerRow + 1 + i);
    r.getCell(1).value = i + 1;
    r.getCell(2).value = a.tipo;
    r.getCell(3).value = a.nivel.toUpperCase();
    r.getCell(4).value = a.estado;
    r.getCell(5).value = a.parque?.nombre ?? '';
    r.getCell(6).value = a.fecha_inicio instanceof Date ? a.fecha_inicio.toLocaleString('es-CO') : String(a.fecha_inicio ?? '');
    r.getCell(7).value = a.fecha_fin instanceof Date ? a.fecha_fin.toLocaleString('es-CO') : '';
    r.getCell(8).value = a.generada_por ?? '';

    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    r.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      cell.font = { size: 10 };
    });

    // Color nivel cell
    const nivelCell = r.getCell(3);
    const nc = a.nivel === 'rojo' ? 'FFE53935' : a.nivel === 'amarillo' ? 'FFD97706' : 'FF16A34A';
    const nbg = a.nivel === 'rojo' ? 'FFFEF2F2' : a.nivel === 'amarillo' ? 'FFFFFBEB' : 'FFF0FDF4';
    nivelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: nbg } };
    nivelCell.font = { bold: true, size: 10, color: { argb: nc } };
    nivelCell.alignment = { horizontal: 'center' };
  });

  // Green bottom border
  const lastRow = ws.getRow(headerRow + 1 + alertas.length);
  lastRow.getCell(1).value = '';
  lastRow.eachCell((cell) => {
    cell.border = { top: { style: 'medium', color: { argb: 'FF85B425' } } };
  });

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
