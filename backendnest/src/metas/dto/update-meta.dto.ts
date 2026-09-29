import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class UpdateMetaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  montoObjetivo?: number;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Min(0)
  montoActual?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsDateString(
    { strict: true },
    { message: 'fechaLimite deve ser uma data valida.' },
  )
  fechaLimite?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
