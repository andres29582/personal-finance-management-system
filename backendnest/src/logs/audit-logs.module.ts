import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [AuthModule],
  controllers: [AuditLogsController],
})
export class AuditLogsModule {}
