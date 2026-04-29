import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EmailJobData } from './email-queue.processor';

export interface EnqueueOptions {
  /** 1=más urgente, 10=normal. Por defecto 5. */
  priority?: number;
  /** Retardo en ms antes de intentar el primer envío. */
  delay?: number;
}

@Injectable()
export class EmailQueueService {
  private readonly log = new Logger('EmailQueueService');

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJobData>) {}

  /**
   * Encola un email con 3 intentos y backoff exponencial (5s, 25s, 125s).
   * Los adjuntos deben venir como Buffer; se convierten a base64 para
   * sobrevivir la serialización JSON de BullMQ.
   */
  async enqueue(
    to: string | string[],
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
    opts?: EnqueueOptions,
  ) {
    const data: EmailJobData = {
      to,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        contentType: a.contentType,
      })),
    };

    const job = await this.queue.add('send-email', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 200, age: 60 * 60 * 24 * 3 },  // 3 días
      removeOnFail: { count: 500, age: 60 * 60 * 24 * 7 },       // 7 días
      priority: opts?.priority ?? 5,
      delay: opts?.delay,
    });

    const recipient = Array.isArray(to) ? to.join(', ') : to;
    this.log.log(`Email encolado job #${job.id} → ${recipient}`);
    return job;
  }

  /** Estadísticas actuales de la cola */
  async stats() {
    const [waiting, active, failed, completed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
      this.queue.getCompletedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, failed, completed, delayed };
  }

  /** Últimos jobs fallidos (máx. 50) */
  async failedJobs(limit = 50) {
    const jobs = await this.queue.getFailed(0, limit - 1);
    return jobs.map((j) => ({
      id: j.id,
      to: j.data.to,
      subject: j.data.subject,
      attempts: j.attemptsMade,
      failedReason: j.failedReason,
      timestamp: new Date(j.timestamp).toISOString(),
    }));
  }

  /** Reintenta todos los jobs fallidos */
  async retryAllFailed() {
    const failed = await this.queue.getFailed(0, 999);
    await Promise.all(failed.map((j) => j.retry()));
    this.log.log(`Reintentando ${failed.length} jobs fallidos`);
    return { retried: failed.length };
  }

  /** Vacía la cola (útil en desarrollo) */
  async drain() {
    await this.queue.drain();
    this.log.warn('Cola de email vaciada (drain)');
    return { ok: true };
  }
}
