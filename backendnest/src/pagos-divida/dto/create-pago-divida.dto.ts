import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
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
  valor: number;

  @IsString()
  @IsNotEmpty()
  data: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
