import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
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
  @IsPositive()
  montoTotal: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tasaInteres?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
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
