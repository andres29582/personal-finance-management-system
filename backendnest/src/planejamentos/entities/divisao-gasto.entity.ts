import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GastoPlanejamento } from './gasto-planejamento.entity';
import { ParticipantePlanejamento } from './participante-planejamento.entity';
import { DivisaoStatus } from '../enums';

@Entity('divisao_gasto')
export class DivisaoGasto {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'gasto_id', type: 'uuid' })
  gastoId: string;

  @Column({ name: 'participante_id', type: 'uuid' })
  participanteId: string;

  @Column({ name: 'valor_devido_centavos', type: 'integer' })
  valorDevidoCentavos: number;

  @Column({ type: 'varchar', length: 20, default: DivisaoStatus.ATIVA })
  status: DivisaoStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => GastoPlanejamento, (gasto) => gasto.divisoes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'gasto_id' })
  gasto: GastoPlanejamento;

  @ManyToOne(
    () => ParticipantePlanejamento,
    (participante) => participante.divisoes,
  )
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipantePlanejamento;
}
