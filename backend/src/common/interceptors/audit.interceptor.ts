import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditoriaLog } from '../entities/auditoria-log.entity';

const SENSITIVE = ['password', 'password_hash', 'refresh_token', 'token'];

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SENSITIVE.includes(k.toLowerCase()) ? '***' : redact(v);
  }
  return out;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly log = new Logger(AuditInterceptor.name);
  constructor(@InjectRepository(AuditoriaLog) private readonly repo: Repository<AuditoriaLog>) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method as string;
    const url = req.originalUrl as string;
    if (method === 'GET' && !url.includes('/auth/')) return next.handle();

    const base: Partial<AuditoriaLog> = {
      usuario_id: req.user?.sub ?? null,
      accion: `${method} ${url}`,
      ip: req.ip ?? null,
      user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
      detalle: redact({ body: req.body, params: req.params, query: req.query }) as Record<string, unknown>,
    };
    return next.handle().pipe(
      tap(() => {
        this.repo.save({ ...base, resultado: 'exito' } as Partial<AuditoriaLog>)
          .catch((e) => this.log.error(e));
      }),
      catchError((err) => {
        this.repo.save({
          ...base,
          detalle: { ...(base.detalle ?? {}), error: err?.message } as Record<string, unknown>,
          resultado: 'error',
        } as Partial<AuditoriaLog>).catch((e) => this.log.error(e));
        return throwError(() => err);
      }),
    );
  }
}
