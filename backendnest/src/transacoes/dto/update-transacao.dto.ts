import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
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
  data?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
