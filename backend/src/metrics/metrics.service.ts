import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'manobi_http_requests_total',
    help: 'Total de requests HTTP procesados',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'manobi_http_request_duration_seconds',
    help: 'Duración de requests HTTP',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly engineCycles = new Counter({
    name: 'manobi_engine_cycles_total',
    help: 'Ejecuciones del motor de alertas',
    labelNames: ['status'],
    registers: [this.registry],
  });

  readonly engineDuration = new Histogram({
    name: 'manobi_engine_cycle_duration_seconds',
    help: 'Duración de un ciclo del motor de alertas',
    buckets: [10, 30, 60, 120, 300, 600, 1200],
    registers: [this.registry],
  });

  readonly alertsGenerated = new Counter({
    name: 'manobi_alerts_generated_total',
    help: 'Alertas generadas por el motor',
    labelNames: ['nivel'],
    registers: [this.registry],
  });

  readonly ideamPolls = new Counter({
    name: 'manobi_ideam_polls_total',
    help: 'Polls IDEAM ejecutados',
    labelNames: ['modo', 'status'],
    registers: [this.registry],
  });

  readonly ideamEvents = new Counter({
    name: 'manobi_ideam_events_inserted_total',
    help: 'Eventos IDEAM insertados',
    labelNames: ['tipo'],
    registers: [this.registry],
  });

  readonly aiCalls = new Counter({
    name: 'manobi_ai_calls_total',
    help: 'Llamadas al servicio IA',
    labelNames: ['endpoint', 'status'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  metrics() { return this.registry.metrics(); }
}
