import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { GastoComportamento } from '../enums';

export class CreateGastoPlanejamentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descricao: string;

  @IsInt()
  @Min(1)
  valorCentavos: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataGasto deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'dataGasto deve ser uma data valida.' },
  )
  dataGasto: string;

  @IsEnum(GastoComportamento)
  comportamento: GastoComportamento;

  @IsUUID()
  pagoPorParticipanteId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  participantesIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'mesReferencia deve estar no formato YYYY-MM.',
  })
  mesReferencia?: string;
}
