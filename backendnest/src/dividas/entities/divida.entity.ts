import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { Periodicidade } from '../enums/periodicidade.enum';

@Entity('divida')
export class Divida {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'conta_id', type: 'uuid', nullable: true })
  contaId: string | null;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ name: 'valor_total', type: 'decimal', precision: 12, scale: 2 })
  montoTotal: number;

  @Column({
    name: 'taxa_juros',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  tasaInteres: number | null;

  @Column({
    name: 'parcela_mensal',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  cuotaMensual: number | null;

  @Column({ name: 'data_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'data_vencimento', type: 'date' })
  fechaVencimiento: string;

  @Column({ name: 'proximo_vencimento', type: 'date', nullable: true })
  proximoVencimiento: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  periodicidade: Periodicidade | null;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
