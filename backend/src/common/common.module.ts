import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaLog } from './entities/auditoria-log.entity';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditoriaLog])],
  providers: [AuditInterceptor],
  exports: [AuditInterceptor, TypeOrmModule],
})
export class CommonModule {}
