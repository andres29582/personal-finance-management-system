import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type PasswordChangedState =
  | 'pending'
  | 'claimed'
  | 'delivered'
  | 'simulated'
  | 'failed'
  | 'reconciliation';

@Entity('password_changed_outbox')
export class PasswordChangedOutbox {
  @PrimaryColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 150 }) recipient: string;
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt: Date;
  @Column({ type: 'varchar', length: 24, default: 'pending' })
  state: PasswordChangedState;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'text', nullable: true }) payload: string | null;
  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  nextAttemptAt: Date;
  @Column({ name: 'first_attempt_at', type: 'timestamptz', nullable: true })
  firstAttemptAt: Date | null;
  @Column({ name: 'lease_until', type: 'timestamptz', nullable: true })
  leaseUntil: Date | null;
  @Column({ name: 'claim_token', type: 'uuid', nullable: true }) claimToken:
    | string
    | null;
  @Column({ name: 'provider_id', type: 'varchar', length: 128, nullable: true })
  providerId: string | null;
  @Column({
    name: 'last_safe_error',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  lastSafeError: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
