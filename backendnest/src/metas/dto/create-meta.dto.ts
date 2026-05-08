import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { TipoMeta } from '../enums/tipo-meta.enum';

export class CreateMetaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoMeta)
  tipo: TipoMeta;

  @IsNumber()
  @IsPositive()
  montoObjetivo: number;

  @IsString()
  @IsNotEmpty()
  fechaLimite: string;

  @IsOptional()
  @IsUUID()
  contaId?: string;

  @IsOptional()
  @IsUUID()
  dividaId?: string;
}
