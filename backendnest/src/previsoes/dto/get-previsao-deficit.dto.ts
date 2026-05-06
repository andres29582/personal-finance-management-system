import { IsOptional, Matches } from 'class-validator';

export class GetPrevisaoDeficitDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  mes?: string;
}
