import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { AuditLogLevel } from '../types/audit-log.types';

@Entity('audit_log')
export class AuditLog {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    type: 'varchar',
    length: 20,
  })
  level: AuditLogLevel;

  @Column({
    type: 'varchar',
    length: 60,
  })
  event: string;

  @Column({
    type: 'varchar',
    length: 40,
  })
  module: string;

  @Column({
    type: 'varchar',
    length: 40,
  })
  action: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  success: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  message: string | null;

  @Column({
    name: 'user_id',
    type: 'uuid',
    nullable: true,
  })
  userId: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  entity: string | null;

  @Column({
    name: 'entity_id',
    type: 'uuid',
    nullable: true,
  })
  entityId: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  method: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  route: string | null;

  @Column({
    name: 'status_code',
    type: 'integer',
    nullable: true,
  })
  statusCode: number | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ip: string | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  userAgent: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  details: Record<string, unknown> | null;
}
