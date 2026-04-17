import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTransferenciaDto {
  @IsUUID()
  contaOrigemId: string;

  @IsUUID()
  contaDestinoId: string;

  @IsNumber()
  valor: number;

  @IsString()
  @IsNotEmpty()
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  comissao?: number;
}
