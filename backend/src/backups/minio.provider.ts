import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

export const BACKUPS_MINIO_CLIENT = 'BACKUPS_MINIO_CLIENT';
export const BACKUPS_BUCKET = 'manobi-backups';

export const backupsMinioProvider: FactoryProvider<MinioClient> = {
  provide: BACKUPS_MINIO_CLIENT,
  inject: [ConfigService],
  useFactory: async (cfg: ConfigService) => {
    const client = new MinioClient({
      endPoint: cfg.get<string>('minio.endpoint')!,
      port: cfg.get<number>('minio.port')!,
      useSSL: cfg.get<boolean>('minio.useSSL')!,
      accessKey: cfg.get<string>('minio.accessKey')!,
      secretKey: cfg.get<string>('minio.secretKey')!,
    });
    const exists = await client.bucketExists(BACKUPS_BUCKET).catch(() => false);
    if (!exists) await client.makeBucket(BACKUPS_BUCKET).catch(() => undefined);
    return client;
  },
};
