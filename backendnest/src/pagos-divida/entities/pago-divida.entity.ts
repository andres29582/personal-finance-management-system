import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('pagamento_divida')
export class PagoDivida {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'divida_id', type: 'uuid' })
  dividaId: string;

  @Column({ name: 'conta_id', type: 'uuid' })
  contaId: string;

  @Column({ name: 'transacao_id', type: 'uuid', unique: true })
  transacaoId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  valor: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
