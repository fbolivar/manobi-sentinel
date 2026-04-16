import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_SUB } from '../redis/redis.module';
import { ALERTS_CHANNEL } from './alertas.service';

@WebSocketGateway({ cors: { origin: '*' }, transports: ['websocket', 'polling'] })
export class AlertsGateway implements OnModuleInit, OnGatewayConnection {
  private readonly log = new Logger('AlertsGateway');
  @WebSocketServer() server!: Server;

  constructor(@Inject(REDIS_SUB) private readonly sub: Redis) {}

  async onModuleInit() {
    await this.sub.subscribe(ALERTS_CHANNEL);
    this.sub.on('message', (channel, payload) => {
      if (channel !== ALERTS_CHANNEL) return;
      try {
        const data = JSON.parse(payload);
        this.server.emit('alerta', data);
        if (data.parque_id) this.server.to(`parque:${data.parque_id}`).emit('alerta:parque', data);
      } catch (e) { this.log.error((e as Error).message); }
    });
    this.log.log(`Subscrito a ${ALERTS_CHANNEL}`);
  }

  handleConnection(client: Socket) {
    const parqueId = client.handshake.query.parque_id as string | undefined;
    if (parqueId) client.join(`parque:${parqueId}`);
  }

  broadcastHotspots(count: number) {
    this.server.emit('hotspots:update', { count, ts: new Date().toISOString() });
  }
}
