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
import { AcertoPlanejamento } from './acerto-planejamento.entity';
import { DivisaoGasto } from './divisao-gasto.entity';
import { GastoPlanejamento } from './gasto-planejamento.entity';
import { Planejamento } from './planejamento.entity';
import { ParticipanteStatus, ParticipanteTipo } from '../enums';

@Entity('participante_planejamento')
export class ParticipantePlanejamento {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'planejamento_id', type: 'uuid' })
  planejamentoId: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, default: ParticipanteTipo.MANUAL })
  tipo: ParticipanteTipo;

  @Column({ type: 'varchar', length: 20, default: ParticipanteStatus.ATIVO })
  status: ParticipanteStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Planejamento, (planejamento) => planejamento.participantes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'planejamento_id' })
  planejamento: Planejamento;

  @OneToMany(() => GastoPlanejamento, (gasto) => gasto.pagoPorParticipante)
  gastosPagos: GastoPlanejamento[];

  @OneToMany(() => DivisaoGasto, (divisao) => divisao.participante)
  divisoes: DivisaoGasto[];

  @OneToMany(() => AcertoPlanejamento, (acerto) => acerto.deParticipante)
  acertosComoPagador: AcertoPlanejamento[];

  @OneToMany(() => AcertoPlanejamento, (acerto) => acerto.paraParticipante)
  acertosComoRecebedor: AcertoPlanejamento[];
}
