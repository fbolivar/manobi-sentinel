import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificacionesService } from './notificaciones.service';

export const EMAIL_QUEUE = 'manobi-email';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

@Processor(EMAIL_QUEUE, {
  concurrency: 3,
})
export class EmailQueueProcessor extends WorkerHost {
  private readonly log = new Logger('EmailQueue');

  constructor(private readonly notif: NotificacionesService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ messageId: string | null }> {
    const { to, subject, html, attachments } = job.data;
    const recipient = Array.isArray(to) ? to.join(', ') : to;
    this.log.log(`Job #${job.id} intento=${job.attemptsMade + 1} → ${recipient}`);

    // Reconstruir buffers desde base64 (BullMQ serializa a JSON, sin Buffer)
    const parsedAttachments = attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    }));

    const info = await this.notif.enviarEmail(to, subject, html, parsedAttachments);
    if (!info) {
      throw new Error(`SMTP devolvió null — se reintentará (job #${job.id})`);
    }

    this.log.log(`Job #${job.id} entregado messageId=${info.messageId}`);
    return { messageId: info.messageId ?? null };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, err: Error) {
    const recipient = Array.isArray(job.data.to) ? job.data.to.join(', ') : job.data.to;
    this.log.error(
      `Job #${job.id} FALLIDO intento=${job.attemptsMade}/${job.opts.attempts} ` +
        `→ ${recipient} | ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>) {
    this.log.debug(`Job #${job.id} completado OK`);
  }
}
