import { Identifiable } from './http.helper';

export type ContaResponse = Identifiable & {
  saldoAtual: number | string;
};

export function expectSaldo(
  contas: ContaResponse[],
  contaId: string,
  saldoEsperado: number,
): void {
  const conta = contas.find((item) => item.id === contaId);

  expect(conta).toBeDefined();
  expect(Number(conta?.saldoAtual)).toBeCloseTo(saldoEsperado, 2);
}
