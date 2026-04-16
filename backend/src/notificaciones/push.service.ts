import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { SuscripcionNotificacion } from '../common/entities/suscripcion.entity';

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger('Push');
  private enabled = false;

  constructor(
    @InjectRepository(SuscripcionNotificacion) private readonly subs: Repository<SuscripcionNotificacion>,
    private readonly cfg: ConfigService,
  ) {}

  onModuleInit() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@manobi.local';
    if (!pub || !priv) {
      this.log.warn('VAPID keys no configuradas — push deshabilitado. Generar con: npx web-push generate-vapid-keys');
      return;
    }
    webpush.setVapidDetails(subject, pub, priv);
    this.enabled = true;
    this.log.log('Web Push habilitado con VAPID');
  }

  publicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async registerSubscription(usuarioId: string, sub: PushSubscriptionJSON, niveles: string[], parqueId?: string) {
    return this.subs.save({
      usuario_id: usuarioId,
      parque_id: parqueId ?? null,
      niveles,
      canal: 'push',
      destino: JSON.stringify(sub),
      activa: true,
    });
  }

  async sendToAll(title: string, body: string, nivel: 'verde' | 'amarillo' | 'rojo', parqueId?: string | null) {
    if (!this.enabled) return;
    const pushSubs = await this.subs.find({
      where: parqueId
        ? [
            { parque_id: parqueId, canal: 'push', activa: true },
            { parque_id: undefined, canal: 'push', activa: true },
          ]
        : { canal: 'push', activa: true },
    });
    const relevantes = pushSubs.filter((s) => s.niveles.includes(nivel));
    const payload = JSON.stringify({ title, body, nivel });

    await Promise.all(
      relevantes.map(async (s) => {
        if (!s.destino) return;
        try {
          const sub = JSON.parse(s.destino) as PushSubscriptionJSON;
          await webpush.sendNotification(sub, payload);
        } catch (e) {
          const err = e as { statusCode?: number; message?: string };
          if (err.statusCode === 404 || err.statusCode === 410) {
            await this.subs.update(s.id, { activa: false });
            this.log.warn(`Push expirado, desactivado: ${s.id}`);
          } else {
            this.log.warn(`Push fallo: ${err.message}`);
          }
        }
      }),
    );
  }
}
