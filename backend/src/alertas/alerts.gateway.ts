import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_SUB } from '../redis/redis.module';
import { ALERTS_CHANNEL } from './alertas.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const wsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

@WebSocketGateway({ cors: { origin: wsOrigins, credentials: true }, transports: ['websocket', 'polling'] })
export class AlertsGateway implements OnModuleInit, OnGatewayConnection {
  private readonly log = new Logger('AlertsGateway');
  @WebSocketServer() server!: Server;

  constructor(
    @Inject(REDIS_SUB) private readonly sub: Redis,
    private readonly jwt: JwtService,
  ) {}

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
    const token = (client.handshake.auth?.token as string | undefined)
      ?? client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify(token);
      client.data.user = payload;
    } catch {
      client.disconnect(true);
      return;
    }

    const parqueId = client.handshake.query.parque_id as string | undefined;
    if (parqueId) {
      if (!UUID_RE.test(parqueId)) {
        client.disconnect(true);
        return;
      }
      client.join(`parque:${parqueId}`);
    }
  }

  broadcastHotspots(count: number) {
    this.server.emit('hotspots:update', { count, ts: new Date().toISOString() });
  }
}
