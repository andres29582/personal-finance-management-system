import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoCategoria } from '../enums/tipo-categoria.enum';

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(TipoCategoria)
  tipo?: TipoCategoria;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsString()
  icone?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
