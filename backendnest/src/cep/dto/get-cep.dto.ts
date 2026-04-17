import { Matches } from 'class-validator';

export class GetCepDto {
  @Matches(/^\d{8}$/)
  cep: string;
}
