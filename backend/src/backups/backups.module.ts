import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { backupsMinioProvider } from './minio.provider';

@Module({
  controllers: [BackupsController],
  providers: [BackupsService, backupsMinioProvider],
})
export class BackupsModule {}
