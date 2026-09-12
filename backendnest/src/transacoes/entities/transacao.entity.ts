import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoTransacao } from '../enums/tipo-transacao.enum';

@Entity('transacao')
export class Transacao {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'conta_id', type: 'uuid' })
  contaId: string;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoTransacao;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  valor: number;

  @Column({ type: 'date' })
  data: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ name: 'eh_ajuste', type: 'boolean', default: false })
  ehAjuste: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'excluido_em', type: 'timestamp', nullable: true })
  excluidoEm: Date | null;
}
