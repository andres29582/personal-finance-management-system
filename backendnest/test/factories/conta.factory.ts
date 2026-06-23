import { TipoConta } from '../../src/contas/enums/tipo-conta.enum';

type ContaPayload = {
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
};

export function makeContaPayload(
  overrides: Partial<ContaPayload> = {},
): ContaPayload {
  return {
    nome: 'Conta E2E',
    tipo: TipoConta.BANCO,
    saldoInicial: 1000,
    ...overrides,
  };
}
