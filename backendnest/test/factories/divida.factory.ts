type DividaPayload = {
  contaId: string;
  nome: string;
  montoTotal: number;
  tasaInteres: number;
  cuotaMensual: number;
  fechaInicio: string;
  fechaVencimiento: string;
  proximoVencimiento: string;
};

export function makeDividaPayload(
  overrides: Partial<DividaPayload> = {},
): DividaPayload {
  return {
    contaId: 'conta-e2e',
    nome: 'Divida E2E',
    montoTotal: 1000,
    tasaInteres: 0,
    cuotaMensual: 100,
    fechaInicio: '2026-05-01',
    fechaVencimiento: '2026-12-01',
    proximoVencimiento: '2026-06-01',
    ...overrides,
  };
}
