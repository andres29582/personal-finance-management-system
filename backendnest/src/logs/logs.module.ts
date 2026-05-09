import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { LogsService } from './logs.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [LogsService, RequestContextService, RequestContextMiddleware],
  exports: [LogsService, RequestContextService, RequestContextMiddleware],
})
export class LogsModule {}
