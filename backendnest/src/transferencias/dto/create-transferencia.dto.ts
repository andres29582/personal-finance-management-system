import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTransferenciaDto {
  @IsUUID()
  contaOrigemId: string;

  @IsUUID()
  contaDestinoId: string;

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsString()
  @IsNotEmpty()
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comissao?: number;
}
