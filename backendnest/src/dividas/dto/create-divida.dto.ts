import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'fechaInicio deve ser uma data valida.' },
  )
  fechaInicio: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaVencimiento deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'fechaVencimiento deve ser uma data valida.' },
  )
  fechaVencimiento: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'proximoVencimiento deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'proximoVencimiento deve ser uma data valida.' },
  )
  proximoVencimiento?: string;

  @IsOptional()
  @IsEnum(Periodicidade)
  periodicidade?: Periodicidade;
}
