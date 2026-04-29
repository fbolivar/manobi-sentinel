import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { IsNull, Repository } from 'typeorm';
import { REDIS_SUB } from '../redis/redis.module';
import { ALERTS_CHANNEL } from '../alertas/alertas.service';
import { Parque } from '../common/entities/parque.entity';
import { SuscripcionNotificacion } from '../common/entities/suscripcion.entity';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplatesService } from './email-templates.service';
import { PushService } from './push.service';

@Injectable()
export class AlertListenerService implements OnModuleInit {
  private readonly log = new Logger('AlertListener');

  constructor(
    @Inject(REDIS_SUB) private readonly sub: Redis,
    @InjectRepository(Parque) private readonly parques: Repository<Parque>,
    @InjectRepository(SuscripcionNotificacion) private readonly subs: Repository<SuscripcionNotificacion>,
    private readonly emailQueue: EmailQueueService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly push: PushService,
    private readonly cfg: ConfigService,
    private readonly http: HttpService,
  ) {}

  async onModuleInit() {
    await this.sub.subscribe(ALERTS_CHANNEL);
    this.sub.on('message', async (channel, payload) => {
      if (channel !== ALERTS_CHANNEL) return;
      try {
        const data = JSON.parse(payload);
        if (data.estado !== 'activa') return;
        await this.handle(data);
      } catch (e) {
        this.log.error((e as Error).message);
      }
    });
    this.log.log(`Escuchando alertas en ${ALERTS_CHANNEL}`);
  }

  private async handle(alerta: {
    id: string; tipo: string; nivel: 'verde' | 'amarillo' | 'rojo';
    descripcion?: string | null; parque_id?: string | null;
    fecha_inicio?: string; estado?: string;
  }) {
    const parque = alerta.parque_id
      ? await this.parques.findOne({ where: { id: alerta.parque_id } })
      : null;
    const { subject, html } = this.emailTemplates.alerta(alerta, parque?.nombre);

    // Destinatarios globales (operadores por defecto)
    const globalOps = this.cfg.get<string[]>('notify.emailOperadores') ?? [];

    // Suscripciones específicas del parque o globales
    const where = alerta.parque_id
      ? [
          { parque_id: alerta.parque_id, activa: true, canal: 'email' as const },
          { parque_id: IsNull(), activa: true, canal: 'email' as const },
        ]
      : [{ parque_id: IsNull(), activa: true, canal: 'email' as const }];
    const subs = await this.subs.find({ where });
    const suscritos = subs
      .filter((s) => s.niveles.includes(alerta.nivel))
      .map((s) => s.destino)
      .filter((d): d is string => !!d);

    // Envío de email vía cola con reintentos: sólo rojo o amarillo (verde se ignora)
    if (alerta.nivel === 'rojo' || alerta.nivel === 'amarillo') {
      const to = Array.from(new Set([
        ...(alerta.nivel === 'rojo' ? globalOps : []),
        ...suscritos,
      ]));
      if (to.length) {
        // Alertas rojas tienen prioridad máxima en la cola
        await this.emailQueue.enqueue(to, subject, html, undefined, {
          priority: alerta.nivel === 'rojo' ? 1 : 3,
        });
      }
    }

    // Push notifications (navegador)
    if (alerta.nivel === 'rojo' || alerta.nivel === 'amarillo') {
      await this.push.sendToAll(
        subject,
        `${alerta.tipo}${parque ? ` — ${parque.nombre}` : ''}`,
        alerta.nivel,
        alerta.parque_id,
      );
    }

    // Webhooks (subscripciones canal webhook)
    if (alerta.nivel === 'rojo') {
      const hooks = await this.subs.find({
        where: alerta.parque_id
          ? [
              { parque_id: alerta.parque_id, activa: true, canal: 'webhook' },
              { parque_id: IsNull(), activa: true, canal: 'webhook' },
            ]
          : [{ parque_id: IsNull(), activa: true, canal: 'webhook' }],
      });
      await Promise.all(
        hooks.filter((h) => h.destino && h.niveles.includes('rojo')).map((h) =>
          firstValueFrom(this.http.post(h.destino!, { alerta, parque }, { timeout: 5000 }))
            .catch((e) => this.log.warn(`Webhook ${h.destino} falló: ${(e as Error).message}`)),
        ),
      );
    }
  }
}
