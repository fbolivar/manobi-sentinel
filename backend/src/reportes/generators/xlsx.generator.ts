import * as ExcelJS from 'exceljs';
import { Alerta } from '../../common/entities/alerta.entity';

export async function alertasToXlsx(alertas: (Alerta & { parque?: { nombre?: string } | null })[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Manobi Sentinel';
  wb.created = new Date();
  const ws = wb.addWorksheet('Alertas');
  ws.columns = [
    { header: 'ID', key: 'id', width: 38 },
    { header: 'Tipo', key: 'tipo', width: 40 },
    { header: 'Nivel', key: 'nivel', width: 10 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Parque', key: 'parque', width: 38 },
    { header: 'Inicio', key: 'fecha_inicio', width: 22 },
    { header: 'Fin', key: 'fecha_fin', width: 22 },
    { header: 'Generada por', key: 'generada_por', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  alertas.forEach((a) => {
    ws.addRow({
      id: a.id, tipo: a.tipo, nivel: a.nivel, estado: a.estado,
      parque: a.parque?.nombre ?? '',
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin ?? '',
      generada_por: a.generada_por ?? '',
    });
    const row = ws.lastRow!;
    const color = a.nivel === 'rojo' ? 'FFFF3B3B' : a.nivel === 'amarillo' ? 'FFFFB020' : 'FF00FF88';
    row.getCell('nivel').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
