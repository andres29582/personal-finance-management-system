import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { TipoAlerta } from '../enums/tipo-alerta.enum';

@Entity('alerta')
export class Alerta {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 50 })
  tipo: TipoAlerta;

  @Column({ name: 'referencia_id', type: 'uuid' })
  referenciaId: string;

  @Column({ name: 'dias_antecedencia', type: 'int' })
  diasAnticipacion: number;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @Column({ name: 'ultima_notificacao', type: 'timestamp', nullable: true })
  ultimaNotificacion: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
