import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParticipantePlanejamento } from './participante-planejamento.entity';
import { Planejamento } from './planejamento.entity';
import { AcertoStatus } from '../enums';

@Entity('acerto_planejamento')
export class AcertoPlanejamento {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'planejamento_id', type: 'uuid' })
  planejamentoId: string;

  @Column({ name: 'de_participante_id', type: 'uuid' })
  deParticipanteId: string;

  @Column({ name: 'para_participante_id', type: 'uuid' })
  paraParticipanteId: string;

  @Column({ name: 'valor_centavos', type: 'integer' })
  valorCentavos: number;

  @Column({ type: 'varchar', length: 20, default: AcertoStatus.PENDENTE })
  status: AcertoStatus;

  @Column({ name: 'data_pagamento', type: 'timestamp', nullable: true })
  dataPagamento: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observacao: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Planejamento, (planejamento) => planejamento.acertos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planejamento_id' })
  planejamento: Planejamento;

  @ManyToOne(
    () => ParticipantePlanejamento,
    (participante) => participante.acertosComoPagador,
  )
  @JoinColumn({ name: 'de_participante_id' })
  deParticipante: ParticipantePlanejamento;

  @ManyToOne(
    () => ParticipantePlanejamento,
    (participante) => participante.acertosComoRecebedor,
  )
  @JoinColumn({ name: 'para_participante_id' })
  paraParticipante: ParticipantePlanejamento;
}
