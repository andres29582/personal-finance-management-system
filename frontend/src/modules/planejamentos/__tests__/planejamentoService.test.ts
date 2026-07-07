import {
  addParticipantePlanejamento,
  createGastoPlanejamento,
  createPlanejamento,
  getGastoPlanejamentoById,
  getPlanejamentoById,
  listGastosPlanejamento,
  listPlanejamentos,
} from '../services/planejamentoService';
import { api } from '../../../shared/services/api';
import {
  AddParticipantePlanejamentoRequest,
  CreateGastoPlanejamentoRequest,
  CreatePlanejamentoRequest,
  GastoPlanejamento,
  ParticipantePlanejamento,
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

function makeParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email: 'ana@example.com',
    id: 'participante-1',
    nome: 'Ana',
    planejamentoId: 'planejamento-1',
    status: 'ATIVO',
    tipo: 'MANUAL',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: null,
    ...overrides,
  };
}

function makeGasto(overrides: Partial<GastoPlanejamento> = {}): GastoPlanejamento {
  return {
    categoria: 'Hospedagem',
    comportamento: 'EVENTUAL',
    comprovanteNome: null,
    comprovanteUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    dataGasto: '2026-01-12',
    deletedAt: null,
    descricao: 'Hotel',
    divisoes: [],
    id: 'gasto-1',
    mesReferencia: null,
    observacao: null,
    pagoPorParticipante: makeParticipante(),
    pagoPorParticipanteId: 'participante-1',
    planejamentoId: 'planejamento-1',
    requerRevisaoMensal: false,
    status: 'ATIVO',
    ultimaAlteracaoValorEm: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    valorCentavos: 12345,
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

  it('adiciona participante ao planejamento', async () => {
    const payload: AddParticipantePlanejamentoRequest = {
      email: 'ana@example.com',
      nome: 'Ana',
    };
    const participante = makeParticipante(payload);
    mockedApi.post.mockResolvedValueOnce({ data: participante });

    const result = await addParticipantePlanejamento('planejamento-1', payload);

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/participantes',
      payload,
    );
    expect(result).toEqual(participante);
  });

  it('lista gastos do planejamento', async () => {
    const gastos = [makeGasto()];
    mockedApi.get.mockResolvedValueOnce({ data: gastos });

    const result = await listGastosPlanejamento('planejamento-1');

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos',
    );
    expect(result).toEqual(gastos);
  });

  it('cria gasto do planejamento', async () => {
    const payload: CreateGastoPlanejamentoRequest = {
      comportamento: 'EVENTUAL',
      dataGasto: '2026-01-12',
      descricao: 'Hotel',
      pagoPorParticipanteId: 'participante-1',
      participantesIds: ['participante-1', 'participante-2'],
      valorCentavos: 12345,
    };
    const gasto = makeGasto(payload);
    mockedApi.post.mockResolvedValueOnce({ data: gasto });

    const result = await createGastoPlanejamento('planejamento-1', payload);

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos',
      payload,
    );
    expect(result).toEqual(gasto);
  });

  it('busca gasto especifico do planejamento', async () => {
    const gasto = makeGasto({ id: 'gasto-2' });
    mockedApi.get.mockResolvedValueOnce({ data: gasto });

    const result = await getGastoPlanejamentoById(
      'planejamento-1',
      'gasto-2',
    );

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos/gasto-2',
    );
    expect(result).toEqual(gasto);
  });
});
