import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
} from 'class-validator';
import { MAX_FINANCIAL_AMOUNT } from '../../common/monetary-limits';
import { HasAtMostTwoDecimalPlaces } from '../../common/monetary-scale.validator';

export class CreatePagoDividaDto {
  @IsUUID()
  dividaId: string;

  @IsUUID()
  contaId: string;

  @IsUUID()
  categoriaId: string;

  @IsNumber()
  @HasAtMostTwoDecimalPlaces()
  @IsPositive()
  @Max(MAX_FINANCIAL_AMOUNT)
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
}
