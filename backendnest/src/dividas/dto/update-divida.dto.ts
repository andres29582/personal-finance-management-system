import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Periodicidade } from '../enums/periodicidade.enum';

export class UpdateDividaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  tasaInteres?: number;

  @IsOptional()
  @IsNumber()
  cuotaMensual?: number;

  @IsOptional()
  @IsString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  proximoVencimiento?: string;

  @IsOptional()
  @IsEnum(Periodicidade)
  periodicidade?: Periodicidade;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
