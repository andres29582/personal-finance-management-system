import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMetaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  montoObjetivo?: number;

  @IsOptional()
  @IsNumber()
  montoActual?: number;

  @IsOptional()
  @IsString()
  fechaLimite?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
