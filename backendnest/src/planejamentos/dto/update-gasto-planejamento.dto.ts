import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { GastoComportamento } from '../enums';

export class UpdateGastoPlanejamentoDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descricao?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  valorCentavos?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataGasto deve estar no formato YYYY-MM-DD.',
  })
  @IsDateString(
    { strict: true },
    { message: 'dataGasto deve ser uma data valida.' },
  )
  dataGasto?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(GastoComportamento)
  comportamento?: GastoComportamento;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  pagoPorParticipanteId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  participantesIds?: string[];

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  categoria?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(500)
  observacao?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'mesReferencia deve estar no formato YYYY-MM.',
  })
  mesReferencia?: string | null;
}