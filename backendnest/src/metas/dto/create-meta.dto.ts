import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';
import { TipoMeta } from '../enums/tipo-meta.enum';

export class CreateMetaDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoMeta)
  tipo: TipoMeta;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  montoObjetivo: number;

  @IsString()
  @IsNotEmpty()
  @IsDateString(
    { strict: true },
    { message: 'fechaLimite deve ser uma data valida.' },
  )
  fechaLimite: string;

  @IsOptional()
  @IsUUID()
  contaId?: string;

  @IsOptional()
  @IsUUID()
  dividaId?: string;
}
