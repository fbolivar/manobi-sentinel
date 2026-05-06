import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReglaAlerta } from '../common/entities/regla-alerta.entity';
import { Parque } from '../common/entities/parque.entity';
import { Prediccion } from '../common/entities/prediccion.entity';
import { EventosService } from '../eventos-climaticos/eventos.service';
import { PrediccionesService } from '../predicciones/predicciones.service';
import { AlertasService } from './alertas.service';
import { evaluar } from './rule-evaluator';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class AlertEngineService implements OnApplicationBootstrap {
  private readonly log = new Logger('AlertEngine');

  constructor(
    @InjectRepository(ReglaAlerta) private readonly reglas: Repository<ReglaAlerta>,
    @InjectRepository(Parque) private readonly parques: Repository<Parque>,
    @InjectRepository(Prediccion) private readonly predicciones: Repository<Prediccion>,
    private readonly eventos: EventosService,
    private readonly prediccionesAI: PrediccionesService,
    private readonly alertas: AlertasService,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap() {
    this.log.log('AlertEngine listo — primer ciclo en el siguiente tick de cron (:00/:15/:30/:45)');
  }

  @Cron('0 */15 * * * *', { name: 'alert-engine', timeZone: 'America/Bogota' })
  async run() {
    const [reglas, parques] = await Promise.all([
      this.reglas.find({ where: { activa: true } }),
      this.parques.find(),
    ]);
    if (reglas.length === 0 || parques.length === 0) return;

    this.log.log(`Evaluando ${reglas.length} reglas × ${parques.length} parques`);
    const started = Date.now();
    let nuevas = 0;
    let dedup = 0;
    let cerradas = 0;
    let status: 'ok' | 'error' = 'ok';

    try {
      const BATCH = 1;
      for (let i = 0; i < parques.length; i += BATCH) {
        const slice = parques.slice(i, i + BATCH);
        const results = await Promise.all(slice.map((p) => this.evaluarParque(p, reglas)));
        for (const r of results) { nuevas += r.nuevas; dedup += r.dedup; cerradas += r.cerradas; }
      }
    } catch (e) {
      status = 'error';
      throw e;
    } finally {
      const secs = (Date.now() - started) / 1000;
      this.metrics.engineCycles.inc({ status });
      this.metrics.engineDuration.observe(secs);
      this.log.log(`Evaluación terminada en ${Math.round(secs)}s. Nuevas: ${nuevas}, dedup: ${dedup}, cerradas: ${cerradas}`);
    }
  }

  private async evaluarParque(parque: Parque, reglas: ReglaAlerta[]): Promise<{ nuevas: number; dedup: number; cerradas: number }> {
    let nuevas = 0;
    let dedup = 0;
    let cerradas = 0;
    let base: Record<string, unknown>;
    try {
      base = await this.eventos.contextoPorParque(parque.id);
    } catch (e) {
      this.log.warn(`contextoPorParque parque ${parque.id} falló (${(e as Error).message}) — usando defaults`);
      base = { lluvia_24h_mm: 0, lluvia_1h_mm: 0, viento_kmh: 0, temperatura_c: 25, humedad_relativa: 75, dias_sin_lluvia: 2, nivel_rio_mt: null };
    }

    const [predIncendio, predInundacion] = await Promise.all([
      this.prediccionesAI.predictIncendio({
        parque_id: parque.id,
        temperatura_c: base.temperatura_c,
        humedad_relativa: base.humedad_relativa,
        dias_sin_lluvia: base.dias_sin_lluvia,
        viento_kmh: base.viento_kmh,
      }),
      this.prediccionesAI.predictInundacion({
        parque_id: parque.id,
        lluvia_24h_mm: base.lluvia_24h_mm,
        lluvia_1h_mm: base.lluvia_1h_mm,
        nivel_rio_mt: base.nivel_rio_mt ?? null,
        nivel_riesgo: parque.nivel_riesgo ?? 'medio',
      }),
    ]);

    const ctx: Record<string, unknown> = {
      ...base,
      'parque.nivel_riesgo': parque.nivel_riesgo,
      'prediccion_ia.probabilidad': Math.max(
        Number(predIncendio?.probabilidad ?? 0),
        Number(predInundacion?.probabilidad ?? 0),
      ),
      'prediccion_ia.incendio': Number(predIncendio?.probabilidad ?? 0),
      'prediccion_ia.inundacion': Number(predInundacion?.probabilidad ?? 0),
      topografia: 'ladera',
    };

    const tiposFired = new Set<string>();

    for (const regla of reglas) {
      try {
        if (!evaluar(regla.condicion, ctx)) continue;
        const nivel = regla.nivel_resultante ?? 'amarillo';
        const tipo = regla.nombre ?? 'alerta';
        tiposFired.add(tipo);
        const res = await this.alertas.createWithDedup({
          tipo,
          nivel,
          descripcion: regla.accion ?? null as unknown as string,
          fecha_inicio: new Date().toISOString(),
          parque_id: parque.id,
        }, 'motor_reglas');
        if (res.nueva) {
          this.metrics.alertsGenerated.inc({ nivel });
          nuevas++;
        } else {
          dedup++;
        }
      } catch (e) {
        this.log.error(`Regla ${regla.id} parque ${parque.id}: ${(e as Error).message}`);
      }
    }

    // Cerrar automáticamente alertas del motor cuya condición ya no se cumple
    try {
      const activas = await this.alertas.findActivas(parque.id);
      for (const alerta of activas) {
        if (alerta.generada_por === 'motor_reglas' && !tiposFired.has(alerta.tipo)) {
          await this.alertas.cerrar(alerta.id, { estado: 'cerrada' });
          cerradas++;
        }
      }
    } catch (e) {
      this.log.error(`Auto-close parque ${parque.id}: ${(e as Error).message}`);
    }

    return { nuevas, dedup, cerradas };
  }
}
