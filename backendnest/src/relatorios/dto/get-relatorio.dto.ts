import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { TipoTransacao } from '../../transacoes/enums/tipo-transacao.enum';
import { PeriodoRelatorio } from '../enums/periodo-relatorio.enum';

export class GetRelatorioDto {
  @IsEnum(PeriodoRelatorio)
  periodo: PeriodoRelatorio;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mes?: string;

  @IsOptional()
  @Matches(/^\d{4}$/)
  ano?: string;

  @IsOptional()
  @Matches(/^[1-4]$/)
  trimestre?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataInicio?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;

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
