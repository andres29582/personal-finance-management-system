import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { TipoMeta } from '../enums/tipo-meta.enum';

@Entity('meta')
export class Meta {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: TipoMeta;

  @Column({ name: 'valor_objetivo', type: 'decimal', precision: 14, scale: 2 })
  montoObjetivo: number;

  @Column({
    name: 'valor_atual',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  montoActual: number;

  @Column({ name: 'data_limite', type: 'date', nullable: true })
  fechaLimite: string | null;

  @Column({ name: 'conta_id', type: 'uuid', nullable: true })
  contaId: string | null;

  @Column({ name: 'divida_id', type: 'uuid', nullable: true })
  dividaId: string | null;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
