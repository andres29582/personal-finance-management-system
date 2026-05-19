import { Injectable } from '@nestjs/common';
import { isValidCep, normalizeDigits } from '../common/br-documents.util';
import {
  ExternalServiceException,
  ResourceNotFoundException,
  ValidationAppException,
} from '../common/exceptions';

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
      throw new ValidationAppException('INVALID_CEP', 'CEP invalido.', {
        field: 'cep',
      });
    }

    const response = await fetch(
      `https://viacep.com.br/ws/${normalizedCep}/json/`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    ).catch(() => {
      throw new ExternalServiceException(
        'CEP_LOOKUP_UNAVAILABLE',
        'Nao foi possivel consultar o CEP.',
      );
    });

    if (!response.ok) {
      throw new ExternalServiceException(
        'CEP_LOOKUP_UNAVAILABLE',
        'Nao foi possivel consultar o CEP.',
      );
    }

    const data = (await response.json()) as ViaCepResponse;

    if (data.erro) {
      throw new ResourceNotFoundException(
        'CEP_NOT_FOUND',
        'CEP nao encontrado.',
      );
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
