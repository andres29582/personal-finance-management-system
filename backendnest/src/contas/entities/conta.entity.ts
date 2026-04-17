import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoConta } from '../enums/tipo-conta.enum';

@Entity('conta')
export class Conta {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoConta;

  @Column({ name: 'saldo_inicial', type: 'decimal', precision: 12, scale: 2 })
  saldoInicial: number;

  @Column({ type: 'varchar', length: 10, default: 'BRL' })
  moeda: string;

  @Column({
    name: 'limite_credito',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  limiteCredito: number | null;

  @Column({ name: 'data_corte', type: 'smallint', nullable: true })
  dataCorte: number | null;

  @Column({ name: 'data_pagamento', type: 'smallint', nullable: true })
  dataPagamento: number | null;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
