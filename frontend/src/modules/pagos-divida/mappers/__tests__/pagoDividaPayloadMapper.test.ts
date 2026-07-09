import { buildPagoDividaPayload } from '../pagoDividaPayloadMapper';

const validValues = {
  categoriaId: 'categoria-1',
  contaId: 'conta-1',
  data: '2026-05-05',
  descricao: '  Pagamento de parcela  ',
  dividaId: 'divida-1',
  valor: '300,75',
};

describe('buildPagoDividaPayload', () => {
  it('builds payment payload with trimmed description', () => {
    expect(buildPagoDividaPayload(validValues, 300.75)).toEqual({
      categoriaId: 'categoria-1',
      contaId: 'conta-1',
      data: '2026-05-05',
      descricao: 'Pagamento de parcela',
      dividaId: 'divida-1',
      valor: 300.75,
    });
  });

  it.each(['', '   '])('omits empty description: %s', (descricao) => {
    expect(
      buildPagoDividaPayload({ ...validValues, descricao }, 300.75),
    ).toMatchObject({
      descricao: undefined,
    });
  });

  it('preserves ISO date in the payload', () => {
    expect(buildPagoDividaPayload(validValues, 300.75)).toMatchObject({
      data: '2026-05-05',
    });
  });
});
