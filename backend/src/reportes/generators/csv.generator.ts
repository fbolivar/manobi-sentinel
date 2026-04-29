import { Alerta } from '../../common/entities/alerta.entity';

export function alertasToCsv(alertas: (Alerta & { parque?: { nombre?: string } | null })[]): Buffer {
  const header = ['id','tipo','nivel','estado','parque','fecha_inicio','fecha_fin','generada_por','descripcion'];
  const rows = alertas.map((a) => [
    a.id, a.tipo, a.nivel, a.estado, a.parque?.nombre ?? '',
    a.fecha_inicio instanceof Date ? a.fecha_inicio.toISOString() : String(a.fecha_inicio ?? ''),
    a.fecha_fin instanceof Date ? a.fecha_fin.toISOString() : String(a.fecha_fin ?? ''),
    a.generada_por ?? '', (a.descripcion ?? '').replace(/"/g, '""'),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return Buffer.from([header.join(','), ...rows].join('\n'), 'utf8');
}
