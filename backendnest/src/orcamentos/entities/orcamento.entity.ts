import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('orcamento')
export class Orcamento {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'mes_referencia', type: 'varchar', length: 7 })
  mesReferencia: string;

  @Column({ name: 'valor_planejado', type: 'decimal', precision: 14, scale: 2 })
  valorPlanejado: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
