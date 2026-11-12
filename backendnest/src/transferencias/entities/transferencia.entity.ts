import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  Check,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transferencia')
@Index(
  'uq_transferencia_usuario_idempotency',
  ['usuarioId', 'idempotencyKey'],
  { unique: true },
)
@Check(
  'ck_transferencia_idempotency_pair',
  '(idempotency_key IS NULL) = (idempotency_fingerprint IS NULL)',
)
export class Transferencia {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'conta_origem_id', type: 'uuid' })
  contaOrigemId: string;

  @Column({ name: 'conta_destino_id', type: 'uuid' })
  contaDestinoId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descricao: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  comissao: number;

  @Column({ type: 'varchar', length: 10, default: 'BRL' })
  moeda: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    name: 'idempotency_key',
    type: 'uuid',
    nullable: true,
    select: false,
  })
  idempotencyKey: string | null;

  @Column({
    name: 'idempotency_fingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
  })
  idempotencyFingerprint: string | null;

  @Column({ name: 'excluido_em', type: 'timestamp', nullable: true })
  excluidoEm: Date | null;
}
