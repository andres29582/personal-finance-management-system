import { IsEnum, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { TipoAlerta } from '../enums/tipo-alerta.enum';

export class CreateAlertaDto {
  @IsEnum(TipoAlerta)
  tipo: TipoAlerta;

  @IsUUID()
  @IsNotEmpty()
  referenciaId: string;

  @IsInt()
  @Min(1)
  diasAnticipacion: number;
}
