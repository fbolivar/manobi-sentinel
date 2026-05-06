import { Controller, ForbiddenException, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

const ALLOWED_NETS = ['127.', '::1', '::ffff:127.', '172.', '10.'];

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(@Req() req: Request) {
    const ip: string = (req.ip ?? req.socket?.remoteAddress ?? '');
    if (!ALLOWED_NETS.some((prefix) => ip.startsWith(prefix))) throw new ForbiddenException();
    return this.svc.metrics();
  }
}
