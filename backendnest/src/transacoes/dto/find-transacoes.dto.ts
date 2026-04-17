import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { TipoTransacao } from '../enums/tipo-transacao.enum';

export class FindTransacoesDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mes?: string;

  @IsOptional()
  @IsEnum(TipoTransacao)
  tipo?: TipoTransacao;

  @IsOptional()
  @IsUUID()
  contaId?: string;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;
}
