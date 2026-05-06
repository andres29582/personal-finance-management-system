import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('usuario')
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nome: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 11, unique: true, nullable: true })
  cpf: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  endereco: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cidade: string | null;

  @Column({ name: 'senha_hash', type: 'varchar', length: 255 })
  senhaHash: string;

  @Column({
    name: 'data_registro',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  dataRegistro: Date;

  @Column({
    name: 'moeda_padrao',
    type: 'varchar',
    length: 10,
    default: 'BRL',
  })
  moedaPadrao: string;

  @Column({
    name: 'lgpd_consentimento_em',
    type: 'timestamp',
    nullable: true,
  })
  lgpdConsentimentoEm: Date | null;
}
