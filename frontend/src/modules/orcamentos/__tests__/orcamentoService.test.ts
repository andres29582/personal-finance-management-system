import {
  createOrcamento,
  getOrcamentoById,
  listOrcamentos,
  updateOrcamento,
} from '../services/orcamentoService';
import { api } from '../../../shared/services/api';
import { CreateOrcamentoRequestDto, Orcamento } from '../types/orcamento';

jest.mock('../../../shared/services/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeOrcamento(overrides: Partial<Orcamento> = {}): Orcamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    gastoAtual: 250,
    id: 'orcamento-1',
    mesReferencia: '2026-04',
    percentualUtilizado: 25,
    restante: 750,
    statusAlerta: 'normal',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: 'usuario-1',
    valorPlanejado: 1000,
    ...overrides,
  };
}

describe('orcamentoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista orcamentos filtrando por ano', async () => {
    const orcamentos = [makeOrcamento()];
    mockedApi.get.mockResolvedValueOnce({ data: orcamentos });

    const result = await listOrcamentos('2026');

    expect(mockedApi.get).toHaveBeenCalledWith('/orcamentos', {
      params: { ano: '2026' },
    });
    expect(result).toEqual(orcamentos);
  });

  it('lista orcamentos sem filtro de ano', async () => {
    const orcamentos = [makeOrcamento()];
    mockedApi.get.mockResolvedValueOnce({ data: orcamentos });

    const result = await listOrcamentos();

    expect(mockedApi.get).toHaveBeenCalledWith('/orcamentos', {
      params: undefined,
    });
    expect(result).toEqual(orcamentos);
  });

  it('busca orcamento por id', async () => {
    const orcamento = makeOrcamento({ id: 'orcamento-2' });
    mockedApi.get.mockResolvedValueOnce({ data: orcamento });

    const result = await getOrcamentoById('orcamento-2');

    expect(mockedApi.get).toHaveBeenCalledWith('/orcamentos/orcamento-2');
    expect(result).toEqual(orcamento);
  });

  it('cria orcamento', async () => {
    const payload: CreateOrcamentoRequestDto = {
      mesReferencia: '2026-05',
      valorPlanejado: 1200,
    };
    const orcamento = makeOrcamento(payload);
    mockedApi.post.mockResolvedValueOnce({ data: orcamento });

    const result = await createOrcamento(payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/orcamentos', payload);
    expect(result).toEqual(orcamento);
  });

  it('atualiza orcamento', async () => {
    const payload = { valorPlanejado: 1500 };
    const orcamento = makeOrcamento(payload);
    mockedApi.patch.mockResolvedValueOnce({ data: orcamento });

    const result = await updateOrcamento('orcamento-1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/orcamentos/orcamento-1', payload);
    expect(result).toEqual(orcamento);
  });
});
