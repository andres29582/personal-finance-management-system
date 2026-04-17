import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TipoTransacao } from '../enums/tipo-transacao.enum';

export class CreateTransacaoDto {
  @IsUUID()
  contaId: string;

  @IsUUID()
  categoriaId: string;

  @IsEnum(TipoTransacao)
  tipo: TipoTransacao;

  @IsNumber()
  valor: number;

  @IsString()
  @IsNotEmpty()
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ehAjuste?: boolean;
}
