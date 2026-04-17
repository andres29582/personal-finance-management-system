import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAlertaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  diasAnticipacion?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
