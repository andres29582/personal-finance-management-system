import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class UpdateTransferenciaDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  comissao?: number;
}
