import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Periodicidade } from '../enums/periodicidade.enum';

export class CreateDividaDto {
  @IsOptional()
  @IsUUID()
  contaId?: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsNumber()
  montoTotal: number;

  @IsOptional()
  @IsNumber()
  tasaInteres?: number;

  @IsOptional()
  @IsNumber()
  cuotaMensual?: number;

  @IsString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsString()
  @IsNotEmpty()
  fechaVencimiento: string;

  @IsOptional()
  @IsString()
  proximoVencimiento?: string;

  @IsOptional()
  @IsEnum(Periodicidade)
  periodicidade?: Periodicidade;
}
