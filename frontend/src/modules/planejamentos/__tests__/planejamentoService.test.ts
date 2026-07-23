import {
  addParticipantePlanejamento,
  arquivarPlanejamento,
  cancelAcertoPlanejamento,
  cancelGastoPlanejamento,
  cancelarPlanejamento,
  createGastoPlanejamento,
  createPlanejamento,
  fecharPlanejamento,
  getGastoPlanejamentoById,
  getPlanejamentoById,
  getResumoPlanejamento,
  listAcertosPlanejamento,
  listGastosPlanejamento,
  listPlanejamentos,
  payAcertoPlanejamento,
  removeParticipantePlanejamento,
  reopenAcertoPlanejamento,
  syncAcertosPlanejamento,
  updateGastoPlanejamento,
} from '../services/planejamentoService';
import { api } from '../../../shared/services/api';
import {
  AcertoPlanejamento,
  AddParticipantePlanejamentoRequest,
  CreateGastoPlanejamentoRequest,
  CreatePlanejamentoRequest,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
  UpdateGastoPlanejamentoRequest,
} from '../types/planejamento';

jest.mock('../../../shared/services/api', () => ({
  api: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
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

function makeAcerto(
  overrides: Partial<AcertoPlanejamento> = {},
): AcertoPlanejamento {
  return {
    dataPagamento: null,
    deParticipante: {
      id: 'participante-2',
      nome: 'Bruno',
    },
    deParticipanteId: 'participante-2',
    id: 'acerto-1',
    observacao: null,
    paraParticipante: {
      id: 'participante-1',
      nome: 'Ana',
    },
    paraParticipanteId: 'participante-1',
    status: 'PENDENTE',
    valorCentavos: 5000,
    ...overrides,
  };
}

function makeResumo(
  overrides: Partial<ResumoFinanceiroPlanejamento> = {},
): ResumoFinanceiroPlanejamento {
  return {
    obrigacaoResidualCentavos: 5000,
    participantes: [
      {
        participante: {
          id: 'participante-1',
          nome: 'Ana',
          status: 'ATIVO',
          tipo: 'MANUAL',
        },
        saldoAbertoCentavos: 5000,
        saldoBrutoCentavos: 5000,
        statusFinanceiro: 'RECEBEDOR',
        totalDevidoCentavos: 5000,
        totalPagoCentavos: 10000,
        totalPagoEmAcertosCentavos: 0,
        totalRecebidoEmAcertosCentavos: 0,
      },
    ],
    planejamentoId: 'planejamento-1',
    situacaoFinanceira: 'PENDENTE',
    statusOperacional: 'ABERTO',
    totalGastosAtivosCentavos: 10000,
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

  it('busca o resumo financeiro do planejamento', async () => {
    const resumo = makeResumo();
    mockedApi.get.mockResolvedValueOnce({ data: resumo });

    const result = await getResumoPlanejamento('planejamento-1');

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/resumo',
    );
    expect(result).toEqual(resumo);
  });

  it.each([
    ['fecha', fecharPlanejamento, 'fechar', 'FECHADO'],
    ['arquiva', arquivarPlanejamento, 'arquivar', 'ARQUIVADO'],
    ['cancela', cancelarPlanejamento, 'cancelar', 'CANCELADO'],
  ] as const)(
    '%s o planejamento com PATCH sem body',
    async (_label, transition, route, status) => {
      const planejamento = makePlanejamento({ status });
      mockedApi.patch.mockResolvedValueOnce({ data: planejamento });

      const result = await transition('planejamento-1');

      expect(mockedApi.patch).toHaveBeenCalledWith(
        `/planejamentos/planejamento-1/${route}`,
      );
      expect(result).toEqual(planejamento);
    },
  );

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

  it('remove participante do planejamento com DELETE sem body', async () => {
    const participanteRemovido = makeParticipante({
      id: 'participante-2',
      status: 'REMOVIDO',
    });

    mockedApi.delete.mockResolvedValueOnce({
      data: participanteRemovido,
    });

    const result = await removeParticipantePlanejamento(
      'planejamento-1',
      'participante-2',
    );

    expect(mockedApi.delete).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/participantes/participante-2',
    );
    expect(result).toEqual(participanteRemovido);
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

  it('atualiza gasto do planejamento com PATCH e envia o payload corretamente', async () => {
    const payload: UpdateGastoPlanejamentoRequest = {
      categoria: 'Transporte',
      comportamento: 'VARIAVEL',
      dataGasto: '2026-01-13',
      descricao: 'Passagens revisadas',
      mesReferencia: '2026-01',
      observacao: 'Valor conferido',
      pagoPorParticipanteId: 'participante-2',
      participantesIds: ['participante-1', 'participante-2'],
      valorCentavos: 15000,
    };
    const gasto = makeGasto(payload);
    mockedApi.patch.mockResolvedValueOnce({ data: gasto });

    const result = await updateGastoPlanejamento(
      'planejamento-1',
      'gasto-1',
      payload,
    );

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos/gasto-1',
      payload,
    );
    expect(result).toEqual(gasto);
  });

  it('aceita null nos campos opcionais da atualizacao de gasto', async () => {
    const payload: UpdateGastoPlanejamentoRequest = {
      categoria: null,
      mesReferencia: null,
      observacao: null,
    };
    const gasto = makeGasto({
      categoria: null,
      mesReferencia: null,
      observacao: null,
    });
    mockedApi.patch.mockResolvedValueOnce({ data: gasto });

    await updateGastoPlanejamento(
      'planejamento-1',
      'gasto-1',
      payload,
    );

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos/gasto-1',
      payload,
    );
  });

  it('cancela gasto do planejamento com PATCH sem body', async () => {
    const gasto = makeGasto({ status: 'CANCELADO' });
    mockedApi.patch.mockResolvedValueOnce({ data: gasto });

    const result = await cancelGastoPlanejamento(
      'planejamento-1',
      'gasto-1',
    );

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/gastos/gasto-1/cancelar',
    );
    expect(result).toEqual(gasto);
  });

  it('lista acertos persistidos do planejamento', async () => {
    const acertos = [makeAcerto()];
    mockedApi.get.mockResolvedValueOnce({ data: acertos });

    const result = await listAcertosPlanejamento('planejamento-1');

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/acertos',
    );
    expect(result).toEqual(acertos);
    expect(result[0].deParticipante).toEqual({
      id: 'participante-2',
      nome: 'Bruno',
    });
    expect(result[0].paraParticipante).toEqual({
      id: 'participante-1',
      nome: 'Ana',
    });
    expect(result[0].deParticipante).not.toHaveProperty('usuarioId');
    expect(result[0].deParticipante).not.toHaveProperty('email');
    expect(result[0].paraParticipante).not.toHaveProperty('planejamentoId');
    expect(result[0].paraParticipante).not.toHaveProperty('createdAt');
    expect(result[0].paraParticipante).not.toHaveProperty('updatedAt');
  });

  it('sincroniza acertos oficiais do planejamento', async () => {
    const acertos = [makeAcerto()];
    mockedApi.post.mockResolvedValueOnce({ data: acertos });

    const result = await syncAcertosPlanejamento('planejamento-1');

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/acertos/sincronizar',
    );
    expect(result).toEqual(acertos);
  });

  it('marca acerto como pago', async () => {
    const acerto = makeAcerto({
      dataPagamento: '2026-01-15T00:00:00.000Z',
      status: 'PAGO',
    });
    mockedApi.patch.mockResolvedValueOnce({ data: acerto });

    const result = await payAcertoPlanejamento('planejamento-1', 'acerto-1');

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/acertos/acerto-1/pagar',
    );
    expect(result).toEqual(acerto);
  });

  it('cancela acerto do planejamento', async () => {
    const acerto = makeAcerto({ status: 'CANCELADO' });
    mockedApi.patch.mockResolvedValueOnce({ data: acerto });

    const result = await cancelAcertoPlanejamento(
      'planejamento-1',
      'acerto-1',
    );

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/acertos/acerto-1/cancelar',
    );
    expect(result).toEqual(acerto);
  });

  it('reabre acerto do planejamento', async () => {
    const acerto = makeAcerto({ status: 'PENDENTE' });
    mockedApi.patch.mockResolvedValueOnce({ data: acerto });

    const result = await reopenAcertoPlanejamento(
      'planejamento-1',
      'acerto-1',
    );

    expect(mockedApi.patch).toHaveBeenCalledWith(
      '/planejamentos/planejamento-1/acertos/acerto-1/reabrir',
    );
    expect(result).toEqual(acerto);
  });
});
