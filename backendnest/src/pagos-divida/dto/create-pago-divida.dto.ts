import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
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
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
