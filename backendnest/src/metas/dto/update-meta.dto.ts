import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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
  @IsPositive()
  montoActual?: number;

  @IsOptional()
  @IsString()
  fechaLimite?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
