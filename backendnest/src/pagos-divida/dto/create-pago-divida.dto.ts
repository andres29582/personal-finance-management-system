import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreatePagoDividaDto {
  @IsUUID()
  dividaId: string;

  @IsUUID()
  contaId: string;

  @IsUUID()
  categoriaId: string;

  @IsNumber()
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
}
