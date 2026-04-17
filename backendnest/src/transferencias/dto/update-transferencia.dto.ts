import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTransferenciaDto {
  @IsOptional()
  @IsNumber()
  valor?: number;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  comissao?: number;
}
