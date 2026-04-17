import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateContaDto {
  @IsOptional()
  @IsString()
  nome?: string;

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

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
