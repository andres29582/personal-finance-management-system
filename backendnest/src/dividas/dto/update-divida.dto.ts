import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Periodicidade } from '../enums/periodicidade.enum';

export class UpdateDividaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tasaInteres?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
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
