import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Orcamento } from './orcamento.entity';

@Entity('orcamento_categoria')
export class OrcamentoCategoria {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'orcamento_id', type: 'uuid' })
  orcamentoId: string;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId: string;

  @Column({ name: 'valor_planejado', type: 'decimal', precision: 14, scale: 2 })
  valorPlanejado: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Orcamento, (orcamento) => orcamento.alocacoes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orcamento_id' })
  orcamento: Orcamento;

  @ManyToOne(() => Categoria, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;
}
