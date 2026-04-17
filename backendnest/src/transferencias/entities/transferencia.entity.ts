import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transferencia')
export class Transferencia {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'conta_origem_id', type: 'uuid' })
  contaOrigemId: string;

  @Column({ name: 'conta_destino_id', type: 'uuid' })
  contaDestinoId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descricao: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  comissao: number;

  @Column({ type: 'varchar', length: 10, default: 'BRL' })
  moeda: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
