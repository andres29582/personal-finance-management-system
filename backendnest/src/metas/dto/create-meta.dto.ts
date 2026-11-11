import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
} from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
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
  @Max(MAX_FINANCIAL_AMOUNT)
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
