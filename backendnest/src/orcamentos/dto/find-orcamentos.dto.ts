import { IsOptional, Matches } from 'class-validator';

export class FindOrcamentosDto {
  @IsOptional()
  @Matches(/^\d{4}$/)
  ano?: string;
}
