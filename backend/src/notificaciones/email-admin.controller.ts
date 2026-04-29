import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificacionesService } from './notificaciones.service';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplatesService } from './email-templates.service';

class TestEmailDto {
  @IsEmail()
  destinatario!: string;

  @IsOptional()
  @IsString()
  mensaje?: string;
}

@ApiTags('email-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('email')
export class EmailAdminController {
  constructor(
    private readonly notif: NotificacionesService,
    private readonly queue: EmailQueueService,
    private readonly templates: EmailTemplatesService,
  ) {}

  /**
   * POST /api/email/test
   * Envía un email de prueba directamente (sin cola) para verificar SMTP.
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envía un email de prueba SMTP (sólo admin)' })
  async testSmtp(@Body() dto: TestEmailDto) {
    const { subject, html } = this.templates.prueba(dto.destinatario);
    const info = await this.notif.enviarEmail(dto.destinatario, subject, html);
    if (!info) {
      return { ok: false, message: 'SMTP falló — revisa los logs del servidor' };
    }
    return { ok: true, messageId: info.messageId, destinatario: dto.destinatario };
  }

  /**
   * POST /api/email/enqueue-test
   * Envía un email de prueba a través de la cola BullMQ.
   */
  @Post('enqueue-test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encola un email de prueba vía BullMQ (sólo admin)' })
  async enqueueTest(@Body() dto: TestEmailDto) {
    const { subject, html } = this.templates.prueba(dto.destinatario);
    const job = await this.queue.enqueue(dto.destinatario, subject, html, undefined, {
      priority: 1,
    });
    return { ok: true, jobId: job.id, destinatario: dto.destinatario };
  }

  /**
   * GET /api/email/queue/stats
   * Devuelve estadísticas de la cola de email.
   */
  @Get('queue/stats')
  @ApiOperation({ summary: 'Estadísticas de la cola de email (sólo admin)' })
  stats() {
    return this.queue.stats();
  }

  /**
   * GET /api/email/queue/failed
   * Lista los jobs fallidos (máx. 50).
   */
  @Get('queue/failed')
  @ApiOperation({ summary: 'Lista jobs fallidos en la cola de email (sólo admin)' })
  failedJobs(@Query('limit') limit?: string) {
    return this.queue.failedJobs(limit ? parseInt(limit, 10) : 50);
  }

  /**
   * POST /api/email/queue/retry-failed
   * Reintenta todos los jobs fallidos.
   */
  @Post('queue/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintenta todos los jobs fallidos (sólo admin)' })
  retryFailed() {
    return this.queue.retryAllFailed();
  }

  /**
   * DELETE /api/email/queue/drain
   * Vacía la cola (sólo usar en desarrollo/pruebas).
   */
  @Delete('queue/drain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vacía la cola de email — solo desarrollo (sólo admin)' })
  drain() {
    return this.queue.drain();
  }

  /**
   * GET /api/email/preview/:tipo
   * Devuelve el HTML de una plantilla para previsualizar en el navegador.
   * tipo: alerta | digest | reporte | bienvenida | prueba
   */
  @Get('preview')
  @ApiOperation({ summary: 'Previsualiza una plantilla de email (sólo admin)' })
  preview(@Query('tipo') tipo = 'prueba') {
    const previews: Record<string, () => { subject: string; html: string }> = {
      prueba: () => this.templates.prueba('admin@ejemplo.com'),
      alerta: () =>
        this.templates.alerta(
          {
            id: '00000000-0000-0000-0000-000000000001',
            tipo: 'Alerta de Incendio Forestal',
            nivel: 'rojo',
            descripcion: 'Temperatura superior a 38°C con vientos de 60 km/h y humedad < 20%. Activar protocolo de evacuación.',
            fecha_inicio: new Date().toISOString(),
          },
          'PNN Sierra Nevada de Santa Marta',
        ),
      digest: () =>
        this.templates.digest(
          [
            { tipo: 'Alerta de Incendio', nivel: 'rojo', parqueNombre: 'PNN Tayrona', descripcion: null, fecha: new Date().toISOString() },
            { tipo: 'Riesgo de Inundación', nivel: 'amarillo', parqueNombre: 'PNN Paramillo', descripcion: null, fecha: new Date().toISOString() },
            { tipo: 'Viento extremo', nivel: 'verde', parqueNombre: 'PNN Los Nevados', descripcion: null, fecha: new Date().toISOString() },
          ],
          new Date(Date.now() - 24 * 3600 * 1000),
          new Date(),
        ),
      reporte: () =>
        this.templates.reporte(
          '00000000-0000-0000-0000-000000000099',
          'reportes/2025/resumen-diario-20250601.pdf',
          'Resumen diario de alertas',
        ),
      bienvenida: () =>
        this.templates.bienvenida('Ana Torres', 'ana.torres@parques.gov.co', 'operador', 'Temp1234!'),
    };

    const fn = previews[tipo] ?? previews.prueba;
    const { subject, html } = fn();
    return { tipo, subject, html };
  }
}
