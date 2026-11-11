import type { SessionFailure } from '../session-policy';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('auth_session')
export class AuthSession {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255 })
  refreshTokenHash: string;

  @Column({ name: 'authenticated_at', type: 'timestamptz', nullable: true })
  authenticatedAt?: Date | null;
  @Column({ name: 'absolute_expires_at', type: 'timestamptz', nullable: true })
  absoluteExpiresAt?: Date | null;
  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt?: Date | null;
  @Column({ name: 'refresh_expires_at', type: 'timestamptz', nullable: true })
  refreshExpiresAt?: Date | null;
  @Column({ name: 'idle_timeout_seconds', type: 'integer', nullable: true })
  idleTimeoutSeconds?: number | null;
  @Column({ name: 'policy_version', type: 'integer', nullable: true })
  policyVersion?: number | null;
  @Column({
    name: 'terminal_reason',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  terminalReason?: SessionFailure | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
