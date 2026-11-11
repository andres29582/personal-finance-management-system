import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
} from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';
import { TipoTransacao } from '../enums/tipo-transacao.enum';

export class UpdateTransacaoDto {
  @IsOptional()
  @IsUUID()
  contaId?: string;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(TipoTransacao)
  tipo?: TipoTransacao;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
  valor?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString({ strict: true }, { message: 'data deve ser uma data valida.' })
  data?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
