import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<{ method: string; route?: { path?: string }; url: string }>();
    const res = ctx.switchToHttp().getResponse<{ statusCode: number }>();
    const start = process.hrtime.bigint();

    const record = () => {
      const route = req.route?.path ?? req.url.split('?')[0] ?? 'unknown';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpDuration.observe(labels, seconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
