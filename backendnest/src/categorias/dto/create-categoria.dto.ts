import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoCategoria } from '../enums/tipo-categoria.enum';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoCategoria)
  tipo: TipoCategoria;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsString()
  icone?: string;
}
