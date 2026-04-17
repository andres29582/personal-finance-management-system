import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TipoConta } from '../enums/tipo-conta.enum';

export class CreateContaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoConta)
  tipo: TipoConta;

  @IsNumber()
  saldoInicial: number;

  @IsOptional()
  @IsNumber()
  limiteCredito?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dataCorte?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dataPagamento?: number;
}
