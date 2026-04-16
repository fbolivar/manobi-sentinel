import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertEngineService } from './alert-engine.service';
import { AlertasService } from './alertas.service';
import { ReglaAlerta } from '../common/entities/regla-alerta.entity';
import { Parque } from '../common/entities/parque.entity';
import { Prediccion } from '../common/entities/prediccion.entity';
import { EventosService } from '../eventos-climaticos/eventos.service';
import { PrediccionesService } from '../predicciones/predicciones.service';
import { MetricsService } from '../metrics/metrics.service';

describe('AlertEngineService', () => {
  const makeRepo = (data: unknown[] = []) => ({ find: jest.fn().mockResolvedValue(data) });

  async function build(opts: {
    reglas?: Partial<ReglaAlerta>[];
    parques?: Partial<Parque>[];
    ctx?: Record<string, unknown>;
    predIncendio?: number;
    predInundacion?: number;
  }) {
    const reglasRepo = makeRepo(opts.reglas);
    const parquesRepo = makeRepo(opts.parques);
    const prediccionesRepo = makeRepo();
    const eventos = { contextoPorParque: jest.fn().mockResolvedValue(opts.ctx ?? {}) };
    const predAI = {
      predictIncendio: jest.fn().mockResolvedValue({ probabilidad: opts.predIncendio ?? 0 }),
      predictInundacion: jest.fn().mockResolvedValue({ probabilidad: opts.predInundacion ?? 0 }),
    };
    const alertas = { create: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const metrics = {
      engineCycles: { inc: jest.fn() },
      engineDuration: { observe: jest.fn() },
      alertsGenerated: { inc: jest.fn() },
    };

    const mod = await Test.createTestingModule({
      providers: [
        AlertEngineService,
        { provide: getRepositoryToken(ReglaAlerta), useValue: reglasRepo },
        { provide: getRepositoryToken(Parque), useValue: parquesRepo },
        { provide: getRepositoryToken(Prediccion), useValue: prediccionesRepo },
        { provide: EventosService, useValue: eventos },
        { provide: PrediccionesService, useValue: predAI },
        { provide: AlertasService, useValue: alertas },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    return { svc: mod.get(AlertEngineService), alertas, predAI, eventos };
  }

  it('short-circuit si no hay reglas', async () => {
    const { svc, alertas, eventos } = await build({ reglas: [], parques: [{ id: 'p1' }] });
    await svc.run();
    expect(eventos.contextoPorParque).not.toHaveBeenCalled();
    expect(alertas.create).not.toHaveBeenCalled();
  });

  it('short-circuit si no hay parques', async () => {
    const reglas = [{ id: 'r1', activa: true, condicion: { operador: 'AND' as const, condiciones: [] } }];
    const { svc, alertas, eventos } = await build({ reglas, parques: [] });
    await svc.run();
    expect(eventos.contextoPorParque).not.toHaveBeenCalled();
    expect(alertas.create).not.toHaveBeenCalled();
  });

  it('crea alerta cuando regla rojo hace match', async () => {
    const reglas = [{
      id: 'r1', nombre: 'Incendio crítico', activa: true, nivel_resultante: 'rojo' as const,
      accion: 'Evacuar zona',
      condicion: { operador: 'AND' as const, condiciones: [{ campo: 'temperatura_c', comparador: '>' as const, valor: 30 }] },
    }];
    const parques = [{ id: 'pq1', nivel_riesgo: 'alto' as const }];
    const ctx = { temperatura_c: 35, humedad_relativa: 25, dias_sin_lluvia: 10, viento_kmh: 20, lluvia_24h_mm: 0, lluvia_1h_mm: 0 };

    const { svc, alertas, predAI } = await build({ reglas, parques, ctx, predIncendio: 80 });
    await svc.run();

    expect(predAI.predictIncendio).toHaveBeenCalledTimes(1);
    expect(predAI.predictInundacion).toHaveBeenCalledTimes(1);
    expect(alertas.create).toHaveBeenCalledTimes(1);
    expect(alertas.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Incendio crítico', nivel: 'rojo', descripcion: 'Evacuar zona', parque_id: 'pq1' }),
      'motor_reglas',
    );
  });

  it('no crea alerta si la regla no matchea', async () => {
    const reglas = [{
      id: 'r1', activa: true, nivel_resultante: 'amarillo' as const,
      condicion: { operador: 'AND' as const, condiciones: [{ campo: 'temperatura_c', comparador: '>' as const, valor: 100 }] },
    }];
    const { svc, alertas } = await build({
      reglas, parques: [{ id: 'pq1' }],
      ctx: { temperatura_c: 20 },
    });
    await svc.run();
    expect(alertas.create).not.toHaveBeenCalled();
  });

  it('usa predicción IA máxima como prediccion_ia.probabilidad', async () => {
    const reglas = [{
      id: 'r1', nombre: 'IA alto', activa: true, nivel_resultante: 'amarillo' as const,
      condicion: { operador: 'AND' as const, condiciones: [{ campo: 'prediccion_ia.probabilidad', comparador: '>=' as const, valor: 50 }] },
    }];
    const { svc, alertas } = await build({
      reglas, parques: [{ id: 'pq1' }], ctx: {},
      predIncendio: 30, predInundacion: 70,
    });
    await svc.run();
    expect(alertas.create).toHaveBeenCalledTimes(1);
  });

  it('continúa con otras reglas si una falla', async () => {
    const reglas = [
      { id: 'rBad', activa: true, nombre: 'mala', nivel_resultante: 'rojo' as const,
        condicion: { operador: 'AND' as const, condiciones: [{ campo: 't', comparador: '>' as const, valor: 0 }] } },
      { id: 'rOk', activa: true, nombre: 'buena', nivel_resultante: 'amarillo' as const,
        condicion: { operador: 'AND' as const, condiciones: [{ campo: 't', comparador: '>' as const, valor: 0 }] } },
    ];
    const { svc, alertas } = await build({ reglas, parques: [{ id: 'pq1' }], ctx: { t: 5 } });
    alertas.create
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValueOnce({ id: 'a2' });

    await svc.run();
    expect(alertas.create).toHaveBeenCalledTimes(2);
  });
});
