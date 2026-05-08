import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateMetaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  montoObjetivo?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  montoActual?: number;

  @IsOptional()
  @IsString()
  fechaLimite?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
