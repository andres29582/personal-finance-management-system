import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DivisaoGasto } from './divisao-gasto.entity';
import { ParticipantePlanejamento } from './participante-planejamento.entity';
import { Planejamento } from './planejamento.entity';
import { GastoComportamento, GastoStatus } from '../enums';

@Entity('gasto_planejamento')
export class GastoPlanejamento {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'planejamento_id', type: 'uuid' })
  planejamentoId: string;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  @Column({ name: 'valor_centavos', type: 'integer' })
  valorCentavos: number;

  @Column({ name: 'data_gasto', type: 'date' })
  dataGasto: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoria: string | null;

  @Column({ type: 'varchar', length: 20 })
  comportamento: GastoComportamento;

  @Column({ type: 'varchar', length: 20, default: GastoStatus.ATIVO })
  status: GastoStatus;

  @Column({ name: 'pago_por_participante_id', type: 'uuid' })
  pagoPorParticipanteId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observacao: string | null;

  @Column({
    name: 'comprovante_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  comprovanteUrl: string | null;

  @Column({
    name: 'comprovante_nome',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  comprovanteNome: string | null;

  @Column({
    name: 'mes_referencia',
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  mesReferencia: string | null;

  @Column({
    name: 'ultima_alteracao_valor_em',
    type: 'timestamp',
    nullable: true,
  })
  ultimaAlteracaoValorEm: Date | null;

  @Column({ name: 'requer_revisao_mensal', type: 'boolean', default: false })
  requerRevisaoMensal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Planejamento, (planejamento) => planejamento.gastos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planejamento_id' })
  planejamento: Planejamento;

  @ManyToOne(
    () => ParticipantePlanejamento,
    (participante) => participante.gastosPagos,
  )
  @JoinColumn({ name: 'pago_por_participante_id' })
  pagoPorParticipante: ParticipantePlanejamento;

  @OneToMany(() => DivisaoGasto, (divisao) => divisao.gasto)
  divisoes: DivisaoGasto[];
}
