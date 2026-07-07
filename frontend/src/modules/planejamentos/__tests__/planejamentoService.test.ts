import {
  createPlanejamento,
  getPlanejamentoById,
  listPlanejamentos,
} from '../services/planejamentoService';
import { api } from '../../../shared/services/api';
import {
  CreatePlanejamentoRequest,
  Planejamento,
} from '../types/planejamento';

jest.mock('../../../shared/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    acertos: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: null,
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    gastos: [],
    id: 'planejamento-1',
    nome: 'Viagem',
    participantes: [],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
    ...overrides,
  };
}

describe('planejamentoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista planejamentos sem filtro de status', async () => {
    const planejamentos = [makePlanejamento()];
    mockedApi.get.mockResolvedValueOnce({ data: planejamentos });

    const result = await listPlanejamentos();

    expect(mockedApi.get).toHaveBeenCalledWith('/planejamentos', {
      params: undefined,
    });
    expect(result).toEqual(planejamentos);
  });

  it('lista planejamentos filtrando por status', async () => {
    const planejamentos = [makePlanejamento({ status: 'FECHADO' })];
    mockedApi.get.mockResolvedValueOnce({ data: planejamentos });

    const result = await listPlanejamentos('FECHADO');

    expect(mockedApi.get).toHaveBeenCalledWith('/planejamentos', {
      params: { status: 'FECHADO' },
    });
    expect(result).toEqual(planejamentos);
  });

  it('cria planejamento', async () => {
    const payload: CreatePlanejamentoRequest = {
      dataFim: '2026-01-20',
      dataInicio: '2026-01-10',
      descricao: 'Custos da viagem',
      nome: 'Viagem',
      tipo: 'VIAGEM',
    };
    const planejamento = makePlanejamento(payload);
    mockedApi.post.mockResolvedValueOnce({ data: planejamento });

    const result = await createPlanejamento(payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/planejamentos', payload);
    expect(result).toEqual(planejamento);
  });

  it('busca planejamento por id', async () => {
    const planejamento = makePlanejamento({ id: 'planejamento-2' });
    mockedApi.get.mockResolvedValueOnce({ data: planejamento });

    const result = await getPlanejamentoById('planejamento-2');

    expect(mockedApi.get).toHaveBeenCalledWith('/planejamentos/planejamento-2');
    expect(result).toEqual(planejamento);
  });
});
