import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as nodemailer from 'nodemailer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificacionesService, SmtpConfig } from './notificaciones.service';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplatesService } from './email-templates.service';

class TestEmailDto {
  @IsEmail()
  destinatario!: string;

  @IsOptional()
  @IsString()
  mensaje?: string;
}

class SaveSmtpConfigDto {
  @IsString() host!: string;
  @IsNumber() @Type(() => Number) port!: number;
  @IsOptional() @IsBoolean() secure?: boolean;
  @IsOptional() @IsString() user?: string;
  @IsOptional() @IsString() pass?: string;
  @IsOptional() @IsString() from?: string;
}

class TestCustomSmtpDto {
  @IsString()
  host!: string;

  @IsNumber()
  @Type(() => Number)
  port!: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  pass?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsEmail()
  destinatario!: string;
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
   * GET /api/email/config
   * Devuelve la configuración SMTP activa (contraseña enmascarada).
   */
  @Get('config')
  @ApiOperation({ summary: 'Obtiene la configuración SMTP activa (sólo admin)' })
  getConfig() {
    return this.notif.getConfig();
  }

  /**
   * PUT /api/email/config
   * Guarda una nueva configuración SMTP en DB y recarga el transporter en caliente.
   */
  @Put('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guarda y aplica configuración SMTP (sólo admin)' })
  async saveConfig(@Body() dto: SaveSmtpConfigDto) {
    await this.notif.saveConfig({
      host: dto.host,
      port: dto.port,
      secure: dto.secure ?? false,
      user: dto.user ?? '',
      pass: dto.pass ?? '',
      from: dto.from ?? dto.user ?? '',
    });
    return { ok: true, message: 'Configuración SMTP guardada y aplicada correctamente' };
  }

  /**
   * POST /api/email/test-custom
   * Prueba cualquier configuración SMTP externa (Gmail, Outlook, O365, etc.)
   * sin modificar la configuración activa del servidor.
   */
  @Post('test-custom')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Prueba una configuración SMTP personalizada (sólo admin)' })
  async testCustomSmtp(@Body() dto: TestCustomSmtpDto) {
    const transport = nodemailer.createTransport({
      host: dto.host,
      port: dto.port,
      secure: dto.secure ?? false,
      auth: dto.user ? { user: dto.user, pass: dto.pass ?? '' } : undefined,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 12_000,
      socketTimeout: 12_000,
    });
    try {
      await transport.verify();
      const info = await transport.sendMail({
        from: dto.from ?? dto.user ?? 'manobi-sentinel@test',
        to: dto.destinatario,
        subject: '[Manobi Sentinel] Prueba de integración SMTP',
        html: `<div style="font-family:Arial,sans-serif;padding:24px;background:#0a0e1a;color:#e2e8f0;border-radius:8px;max-width:520px">
          <h2 style="color:#00ff88;margin:0 0 12px">✓ Integración verificada</h2>
          <p>La conexión SMTP con <strong>${dto.host}:${dto.port}</strong> funciona correctamente.</p>
          <p style="color:#94a3b8;font-size:13px">Enviado desde Manobi Sentinel — Parques Nacionales Naturales de Colombia</p>
        </div>`,
      });
      return { ok: true, messageId: info.messageId, host: dto.host, port: dto.port };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      transport.close();
    }
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
