import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidCep, normalizeDigits } from '../common/br-documents.util';

type ViaCepResponse = {
  cep?: string;
  erro?: boolean;
  localidade?: string;
  logradouro?: string;
};

@Injectable()
export class CepService {
  async lookup(cep: string) {
    const normalizedCep = normalizeDigits(cep);

    if (!isValidCep(normalizedCep)) {
      throw new BadRequestException('CEP invalido.');
    }

    const response = await fetch(
      `https://viacep.com.br/ws/${normalizedCep}/json/`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    ).catch(() => {
      throw new BadGatewayException('Nao foi possivel consultar o CEP.');
    });

    if (!response.ok) {
      throw new BadGatewayException('Nao foi possivel consultar o CEP.');
    }

    const data = (await response.json()) as ViaCepResponse;

    if (data.erro) {
      throw new NotFoundException('CEP nao encontrado.');
    }

    return {
      cep: data.cep ?? this.formatCep(normalizedCep),
      endereco: data.logradouro?.trim() ?? '',
      cidade: data.localidade?.trim() ?? '',
    };
  }

  private formatCep(cep: string) {
    return `${cep.slice(0, 5)}-${cep.slice(5)}`;
  }
}
