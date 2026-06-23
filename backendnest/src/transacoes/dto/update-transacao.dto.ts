import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
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
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'data deve ser uma data valida.' },
  )
  data?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
