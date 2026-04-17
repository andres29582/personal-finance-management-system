import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CepService } from './cep.service';

describe('CepService', () => {
  let service: CepService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new CepService();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects invalid CEP values', async () => {
    await expect(service.lookup('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps ViaCEP data to the app response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cep: '01001-000',
        localidade: 'Sao Paulo',
        logradouro: 'Praca da Se',
      }),
    } as Partial<Response>);

    await expect(service.lookup('01001000')).resolves.toEqual({
      cep: '01001-000',
      cidade: 'Sao Paulo',
      endereco: 'Praca da Se',
    });
  });

  it('throws when ViaCEP reports an unknown CEP', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        erro: true,
      }),
    } as Partial<Response>);

    await expect(service.lookup('01001000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws a gateway error when the external service fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: jest.fn(),
    } as Partial<Response>);

    await expect(service.lookup('01001000')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
