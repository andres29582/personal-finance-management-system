import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { TipoCategoria } from '../enums/tipo-categoria.enum';

@Entity('categoria')
export class Categoria {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 100 })
  nome: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoCategoria;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cor: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icone: string | null;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
