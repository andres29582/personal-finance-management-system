import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreateTransferenciaDto {
  @IsUUID()
  contaOrigemId: string;

  @IsUUID()
  contaDestinoId: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  valor: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString({ strict: true }, { message: 'data deve ser uma data valida.' })
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @Min(0)
  comissao?: number;
}
