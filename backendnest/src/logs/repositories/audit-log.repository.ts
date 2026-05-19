import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {
    super(auditLogRepository);
  }

  createAuditLog(log: Partial<AuditLog>): AuditLog {
    return this.auditLogRepository.create(log);
  }

  async saveAuditLog(log: AuditLog): Promise<AuditLog> {
    return this.auditLogRepository.save(log);
  }

  async findAndCountByUser(
    userId: string,
    take: number,
    skip: number,
  ): Promise<[AuditLog[], number]> {
    return this.auditLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }
}
