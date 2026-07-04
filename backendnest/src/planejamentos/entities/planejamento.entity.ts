import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcertoPlanejamento } from './acerto-planejamento.entity';
import { GastoPlanejamento } from './gasto-planejamento.entity';
import { ParticipantePlanejamento } from './participante-planejamento.entity';
import { PlanejamentoStatus, PlanejamentoTipo } from '../enums';

@Entity('planejamento')
export class Planejamento {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_criador_id', type: 'uuid' })
  usuarioCriadorId: string;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descricao: string | null;

  @Column({ type: 'varchar', length: 20 })
  tipo: PlanejamentoTipo;

  @Column({ type: 'varchar', length: 20, default: PlanejamentoStatus.ABERTO })
  status: PlanejamentoStatus;

  @Column({ name: 'data_inicio', type: 'date', nullable: true })
  dataInicio: string | null;

  @Column({ name: 'data_fim', type: 'date', nullable: true })
  dataFim: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @OneToMany(
    () => ParticipantePlanejamento,
    (participante) => participante.planejamento,
  )
  participantes: ParticipantePlanejamento[];

  @OneToMany(() => GastoPlanejamento, (gasto) => gasto.planejamento)
  gastos: GastoPlanejamento[];

  @OneToMany(() => AcertoPlanejamento, (acerto) => acerto.planejamento)
  acertos: AcertoPlanejamento[];
}
