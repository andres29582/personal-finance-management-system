import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { PlanejamentoGastoFormScreen } from '../screens/PlanejamentoGastoFormScreen';
import * as planejamentoService from '../services/planejamentoService';
import * as authStorage from '../../../../storage/authStorage';
import { UsuarioLogado } from '../../../../types/auth';
import {
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
} from '../types/planejamento';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { id: 'planejamento-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/planejamentoService');
jest.mock('../../../../storage/authStorage');

const mockGetUser = authStorage.getUser as jest.MockedFunction<
  typeof authStorage.getUser
>;

const mockGetPlanejamentoById =
  planejamentoService.getPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getPlanejamentoById
  >;
const mockCreateGastoPlanejamento =
  planejamentoService.createGastoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.createGastoPlanejamento
  >;
const mockGetGastoPlanejamentoById =
  planejamentoService.getGastoPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getGastoPlanejamentoById
  >;
const mockUpdateGastoPlanejamento =
  planejamentoService.updateGastoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.updateGastoPlanejamento
  >;

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let reject: Deferred<T>['reject'] = () => undefined;
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function makeUser(id = 'usuario-1'): UsuarioLogado {
  return {
    email: `${id}@example.com`,
    id,
    nome: `Usuario ${id}`,
  };
}

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
    participantes: [
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        email: 'ana@example.com',
        id: 'participante-1',
        nome: 'Ana',
        planejamentoId: 'planejamento-1',
        status: 'ATIVO',
        tipo: 'VINCULADO',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: 'usuario-1',
      },
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        email: 'bruno@example.com',
        id: 'participante-2',
        nome: 'Bruno',
        planejamentoId: 'planejamento-1',
        status: 'ATIVO',
        tipo: 'MANUAL',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: null,
      },
    ],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
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
    mesReferencia: '2026-01',
    observacao: 'Pago no cartao',
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

function makeParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email: null,
    id: 'participante-extra',
    nome: 'Participante extra',
    planejamentoId: 'planejamento-1',
    status: 'ATIVO',
    tipo: 'MANUAL',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: null,
    ...overrides,
  };
}

function makeHistoricalParticipantsScenario() {
  const planejamentoBase = makePlanejamento();
  const pagadorRemovido = makeParticipante({
    id: 'participante-pagador-removido',
    nome: 'Pagador removido',
    status: 'REMOVIDO',
  });
  const divisaoRemovido = makeParticipante({
    id: 'participante-divisao-removido',
    nome: 'Divisao removido',
    status: 'REMOVIDO',
  });
  const removidoNaoRelacionado = makeParticipante({
    id: 'participante-removido-nao-relacionado',
    nome: 'Removido nao relacionado',
    status: 'REMOVIDO',
  });

  return {
    gasto: makeGasto({
      divisoes: [
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          gastoId: 'gasto-1',
          id: 'divisao-ativa',
          participanteId: 'participante-1',
          status: 'ATIVA',
          updatedAt: '2026-01-01T00:00:00.000Z',
          valorDevidoCentavos: 6173,
        },
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          gastoId: 'gasto-1',
          id: 'divisao-historica-ativa',
          participanteId: divisaoRemovido.id,
          status: 'ATIVA',
          updatedAt: '2026-01-01T00:00:00.000Z',
          valorDevidoCentavos: 6172,
        },
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          gastoId: 'gasto-1',
          id: 'divisao-historica-cancelada',
          participanteId: removidoNaoRelacionado.id,
          status: 'CANCELADA',
          updatedAt: '2026-01-01T00:00:00.000Z',
          valorDevidoCentavos: 6172,
        },
      ],
      pagoPorParticipante: pagadorRemovido,
      pagoPorParticipanteId: pagadorRemovido.id,
    }),
    planejamento: makePlanejamento({
      participantes: [
        ...(planejamentoBase.participantes ?? []),
        pagadorRemovido,
        divisaoRemovido,
        removidoNaoRelacionado,
      ],
    }),
  };
}

async function renderReady() {
  render(<PlanejamentoGastoFormScreen />);

  await waitFor(() => {
    expect(screen.getByText('Salvar gasto')).toBeTruthy();
  });
}

async function renderEditReady() {
  render(<PlanejamentoGastoFormScreen />);

  await waitFor(() => {
    expect(screen.getByText('Salvar alteracoes')).toBeTruthy();
  });
}

function fillRequiredExpenseFields() {
  fireEvent.changeText(screen.getByPlaceholderText('Ex.: Hospedagem'), 'Hotel');
  fireEvent.changeText(screen.getByPlaceholderText('0,00'), '123,45');
  fireEvent.changeText(screen.getByPlaceholderText('2026-04-07'), '2026-01-12');
}

function makeActiveLinkedActorPlanejamento(
  overrides: Partial<Planejamento> = {},
) {
  return makePlanejamento({
    participantes: [
      makeParticipante({
        email: 'actor@example.com',
        id: 'participante-actor',
        nome: 'Actor vinculado',
        tipo: 'VINCULADO',
        usuarioId: 'usuario-actor',
      }),
    ],
    usuarioCriadorId: 'usuario-owner',
    ...overrides,
  });
}

function makeGastoWithActiveDivision(
  overrides: Partial<GastoPlanejamento> = {},
) {
  return makeGasto({
    divisoes: [
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        gastoId: overrides.id ?? 'gasto-1',
        id: `divisao-${overrides.id ?? 'gasto-1'}`,
        participanteId: 'participante-1',
        status: 'ATIVA',
        updatedAt: '2026-01-01T00:00:00.000Z',
        valorDevidoCentavos: overrides.valorCentavos ?? 12345,
      },
    ],
    ...overrides,
  });
}

function submitValidCreation(
  payerId = 'participante-1',
  splitId = payerId,
) {
  fillRequiredExpenseFields();
  fireEvent.press(screen.getByTestId(`payer-${payerId}`));
  fireEvent.press(screen.getByTestId(`split-${splitId}`));
  fireEvent.press(screen.getByText('Salvar gasto'));
}

async function settleAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PlanejamentoGastoFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockGetUser.mockResolvedValue(makeUser());
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetGastoPlanejamentoById.mockResolvedValue(makeGasto());
    mockUpdateGastoPlanejamento.mockResolvedValue(makeGasto());
  });

  it('bloqueia envio sem descricao', async () => {
    await renderReady();

    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(screen.getByText('Informe a descricao do gasto.')).toBeTruthy();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });
  });

  it('bloqueia valor menor ou igual a zero', async () => {
    await renderReady();

    fireEvent.changeText(screen.getByPlaceholderText('Ex.: Hospedagem'), 'Hotel');
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '0');
    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(screen.getByText('O valor deve ser maior que zero.')).toBeTruthy();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });
  });

  it('bloqueia envio sem pagador', async () => {
    await renderReady();
    fillRequiredExpenseFields();

    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(screen.getByText('Selecione quem pagou o gasto.')).toBeTruthy();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });
  });

  it('bloqueia envio sem participantes para dividir', async () => {
    await renderReady();
    fillRequiredExpenseFields();

    fireEvent.press(screen.getByTestId('payer-participante-1'));
    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(
        screen.getByText('Selecione ao menos um participante para dividir o gasto.'),
      ).toBeTruthy();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });
  });

  it('cria gasto e volta ao detalhe', async () => {
    mockCreateGastoPlanejamento.mockResolvedValue(makeGasto());
    await renderReady();

    fillRequiredExpenseFields();
    fireEvent.changeText(
      screen.getByPlaceholderText('Categoria opcional'),
      'Hospedagem',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Detalhes opcionais'),
      'Pago no cartao',
    );
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-01');
    fireEvent.press(screen.getByTestId('payer-participante-1'));
    fireEvent.press(screen.getByTestId('split-participante-1'));
    fireEvent.press(screen.getByTestId('split-participante-2'));
    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(mockCreateGastoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        {
          categoria: 'Hospedagem',
          comportamento: 'EVENTUAL',
          dataGasto: '2026-01-12',
          descricao: 'Hotel',
          mesReferencia: '2026-01',
          observacao: 'Pago no cartao',
          pagoPorParticipanteId: 'participante-1',
          participantesIds: ['participante-1', 'participante-2'],
          valorCentavos: 12345,
        },
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('omite campos opcionais vazios na criacao', async () => {
    mockCreateGastoPlanejamento.mockResolvedValue(makeGasto());
    await renderReady();

    fillRequiredExpenseFields();
    fireEvent.press(screen.getByTestId('payer-participante-1'));
    fireEvent.press(screen.getByTestId('split-participante-1'));
    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(mockCreateGastoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        {
          comportamento: 'EVENTUAL',
          dataGasto: '2026-01-12',
          descricao: 'Hotel',
          pagoPorParticipanteId: 'participante-1',
          participantesIds: ['participante-1'],
          valorCentavos: 12345,
        },
      );
    });
  });

  it('busca e preenche todos os campos no modo edicao usando somente divisoes ativas', async () => {
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetGastoPlanejamentoById.mockResolvedValue(
      makeGasto({
        divisoes: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            gastoId: 'gasto-1',
            id: 'divisao-ativa',
            participanteId: 'participante-1',
            status: 'ATIVA',
            updatedAt: '2026-01-01T00:00:00.000Z',
            valorDevidoCentavos: 6173,
          },
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            gastoId: 'gasto-1',
            id: 'divisao-cancelada',
            participanteId: 'participante-2',
            status: 'CANCELADA',
            updatedAt: '2026-01-01T00:00:00.000Z',
            valorDevidoCentavos: 6172,
          },
        ],
      }),
    );

    await renderEditReady();

    expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
    expect(mockGetGastoPlanejamentoById).toHaveBeenCalledWith(
      'planejamento-1',
      'gasto-1',
    );
    expect(screen.getByText('Editar gasto')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ex.: Hospedagem').props.value).toBe(
      'Hotel',
    );
    expect(screen.getByPlaceholderText('0,00').props.value).toBe('123,45');
    expect(screen.getByPlaceholderText('2026-04-07').props.value).toBe(
      '2026-01-12',
    );
    expect(screen.getByPlaceholderText('Categoria opcional').props.value).toBe(
      'Hospedagem',
    );
    expect(screen.getByPlaceholderText('Detalhes opcionais').props.value).toBe(
      'Pago no cartao',
    );
    expect(screen.getByPlaceholderText('2026-04').props.value).toBe('2026-01');
    expect(
      screen.getByTestId('payer-participante-1').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(
      screen.getByTestId('split-participante-1').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(
      screen.getByTestId('split-participante-2').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false }));
  });

  it('separa participantes historicos conforme o papel atual do gasto', async () => {
    const { gasto, planejamento } = makeHistoricalParticipantsScenario();
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetPlanejamentoById.mockResolvedValue(planejamento);
    mockGetGastoPlanejamentoById.mockResolvedValue(gasto);

    await renderEditReady();

    expect(
      screen.getByTestId('payer-participante-pagador-removido').props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true, disabled: false }));
    expect(
      screen.queryByTestId('split-participante-pagador-removido'),
    ).toBeNull();
    expect(
      screen.getByTestId('split-participante-divisao-removido').props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true, disabled: false }));
    expect(
      screen.queryByTestId('payer-participante-divisao-removido'),
    ).toBeNull();
    expect(
      screen.queryByTestId('payer-participante-removido-nao-relacionado'),
    ).toBeNull();
    expect(
      screen.queryByTestId('split-participante-removido-nao-relacionado'),
    ).toBeNull();
  });

  it('remove historicos, impede nova selecao e exclui o participante retirado do payload', async () => {
    const { gasto, planejamento } = makeHistoricalParticipantsScenario();
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetPlanejamentoById.mockResolvedValue(planejamento);
    mockGetGastoPlanejamentoById.mockResolvedValue(gasto);
    await renderEditReady();

    fireEvent.press(
      screen.getByTestId('split-participante-divisao-removido'),
    );
    fireEvent.press(screen.getByTestId('payer-participante-1'));

    await waitFor(() => {
      expect(
        screen.getByTestId('split-participante-divisao-removido').props
          .accessibilityState,
      ).toEqual(expect.objectContaining({ checked: false, disabled: true }));
      expect(
        screen.getByTestId('payer-participante-pagador-removido').props
          .accessibilityState,
      ).toEqual(expect.objectContaining({ checked: false, disabled: true }));
      expect(
        screen.getByTestId('payer-participante-1').props.accessibilityState,
      ).toEqual(expect.objectContaining({ checked: true }));
    });

    fireEvent.press(
      screen.getByTestId('split-participante-divisao-removido'),
    );
    fireEvent.press(
      screen.getByTestId('payer-participante-pagador-removido'),
    );

    expect(
      screen.getByTestId('split-participante-divisao-removido').props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false, disabled: true }));
    expect(
      screen.getByTestId('payer-participante-1').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));

    fireEvent.press(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(mockUpdateGastoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'gasto-1',
        expect.objectContaining({
          pagoPorParticipanteId: 'participante-1',
          participantesIds: ['participante-1'],
        }),
      );
      expect(
        mockUpdateGastoPlanejamento.mock.calls[0][2].participantesIds,
      ).not.toContain('participante-divisao-removido');
    });
  });

  it('envia a atualizacao e usa null quando opcionais sao apagados', async () => {
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetGastoPlanejamentoById.mockResolvedValue(
      makeGasto({
        divisoes: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            gastoId: 'gasto-1',
            id: 'divisao-1',
            participanteId: 'participante-1',
            status: 'ATIVA',
            updatedAt: '2026-01-01T00:00:00.000Z',
            valorDevidoCentavos: 12345,
          },
        ],
      }),
    );
    await renderEditReady();

    fireEvent.changeText(screen.getByPlaceholderText('Categoria opcional'), '');
    fireEvent.changeText(screen.getByPlaceholderText('Detalhes opcionais'), '');
    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '');
    fireEvent.press(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(mockUpdateGastoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'gasto-1',
        {
          categoria: null,
          comportamento: 'EVENTUAL',
          dataGasto: '2026-01-12',
          descricao: 'Hotel',
          mesReferencia: null,
          observacao: null,
          pagoPorParticipanteId: 'participante-1',
          participantesIds: ['participante-1'],
          valorCentavos: 12345,
        },
      );
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('bloqueia edicao quando o planejamento nao esta aberto', async () => {
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ status: 'FECHADO' }),
    );

    render(<PlanejamentoGastoFormScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
        'Apenas planejamentos abertos permitem criar ou editar gastos.',
        ),
      ).toBeTruthy();
    });
    expect(screen.queryByText('Salvar alteracoes')).toBeNull();
    expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
  });

  it.each(['CANCELADO', 'PENDENTE_REVISAO'] as const)(
    'bloqueia edicao quando o gasto esta %s',
    async (status) => {
      mockLocalSearchParams = {
        gastoId: 'gasto-1',
        id: 'planejamento-1',
      };
      mockGetGastoPlanejamentoById.mockResolvedValue(makeGasto({ status }));

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(
          screen.getByText('Apenas gastos ativos podem ser editados.'),
        ).toBeTruthy();
      });
      expect(screen.queryByText('Salvar alteracoes')).toBeNull();
      expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
    },
  );

  it('redireciona para login quando a atualizacao retorna 401', async () => {
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetGastoPlanejamentoById.mockResolvedValue(
      makeGasto({
        divisoes: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            gastoId: 'gasto-1',
            id: 'divisao-1',
            participanteId: 'participante-1',
            status: 'ATIVA',
            updatedAt: '2026-01-01T00:00:00.000Z',
            valorDevidoCentavos: 12345,
          },
        ],
      }),
    );
    mockUpdateGastoPlanejamento.mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' }, status: 401 },
    });
    await renderEditReady();

    fireEvent.press(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(
        screen.getByText('Sessao expirada. Faca login novamente.'),
      ).toBeTruthy();
    });
  });

  it('impede duplo envio durante a atualizacao', async () => {
    let resolveUpdate: (value: GastoPlanejamento) => void = () => undefined;
    mockLocalSearchParams = {
      gastoId: 'gasto-1',
      id: 'planejamento-1',
    };
    mockGetGastoPlanejamentoById.mockResolvedValue(
      makeGasto({
        divisoes: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            gastoId: 'gasto-1',
            id: 'divisao-1',
            participanteId: 'participante-1',
            status: 'ATIVA',
            updatedAt: '2026-01-01T00:00:00.000Z',
            valorDevidoCentavos: 12345,
          },
        ],
      }),
    );
    mockUpdateGastoPlanejamento.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    await renderEditReady();

    const saveButton = screen.getByText('Salvar alteracoes');
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(mockUpdateGastoPlanejamento).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Salvando...')).toBeTruthy();

    await act(async () => {
      resolveUpdate(makeGasto());
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('mostra erro quando criar gasto falha', async () => {
    mockCreateGastoPlanejamento.mockRejectedValue({
      response: { status: 422, data: { message: 'Participantes invalidos.' } },
    });
    await renderReady();

    fillRequiredExpenseFields();
    fireEvent.press(screen.getByTestId('payer-participante-1'));
    fireEvent.press(screen.getByTestId('split-participante-1'));
    fireEvent.press(screen.getByText('Salvar gasto'));

    await waitFor(() => {
      expect(screen.getByText('Participantes invalidos.')).toBeTruthy();
    });
  });

  it('bloqueia criacao quando planejamento nao tem participantes', async () => {
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ participantes: [] }),
    );

    render(<PlanejamentoGastoFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum participante disponivel')).toBeTruthy();
      expect(
        screen.getByText('Adicione ao menos um participante antes de criar um gasto.'),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Adicionar participante'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-participante-form',
      params: { id: 'planejamento-1' },
    });
  });

  describe('autorizacao de criacao', () => {
    it('permite que participante vinculado ativo crie gasto em planejamento aberto', async () => {
      mockGetUser.mockResolvedValue(makeUser('usuario-actor'));
      mockGetPlanejamentoById.mockResolvedValue(
        makeActiveLinkedActorPlanejamento(),
      );
      const creationDeferred = createDeferred<GastoPlanejamento>();
      mockCreateGastoPlanejamento.mockReturnValue(creationDeferred.promise);

      await renderReady();
      await submitValidCreation('participante-actor');
      expect(mockCreateGastoPlanejamento).toHaveBeenCalledTimes(1);

      await act(async () => {
        creationDeferred.resolve(makeGasto());
      });

      await waitFor(() => {
        expect(mockCreateGastoPlanejamento).toHaveBeenCalledWith(
          'planejamento-1',
          expect.objectContaining({
            pagoPorParticipanteId: 'participante-actor',
            participantesIds: ['participante-actor'],
          }),
        );
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/planejamentos-detail',
          params: { id: 'planejamento-1' },
        });
      });
    });

    it.each([
      {
        label: 'vinculado removido',
        participante: {
          status: 'REMOVIDO' as const,
          tipo: 'VINCULADO' as const,
        },
      },
      {
        label: 'vinculado pendente',
        participante: {
          status: 'PENDENTE' as const,
          tipo: 'VINCULADO' as const,
        },
      },
      {
        label: 'participante manual',
        participante: {
          status: 'ATIVO' as const,
          tipo: 'MANUAL' as const,
        },
      },
    ])(
      'bloqueia criacao para $label mesmo quando o usuarioId coincide',
      async ({ participante }) => {
        mockGetUser.mockResolvedValue(makeUser('usuario-actor'));
        mockGetPlanejamentoById.mockResolvedValue(
          makePlanejamento({
            participantes: [
              makeParticipante({
                ...participante,
                id: 'participante-actor',
                usuarioId: 'usuario-actor',
              }),
            ],
            usuarioCriadorId: 'usuario-owner',
          }),
        );

        render(<PlanejamentoGastoFormScreen />);

        await waitFor(() => {
          expect(
            screen.getByText(
              'Voce nao possui permissao para criar gastos neste planejamento.',
            ),
          ).toBeTruthy();
        });
        expect(screen.queryByText('Salvar gasto')).toBeNull();
        expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
      },
    );

    it('bloqueia criacao para usuario nao vinculado', async () => {
      mockGetUser.mockResolvedValue(makeUser('usuario-sem-vinculo'));
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ usuarioCriadorId: 'usuario-owner' }),
      );

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(screen.getByText('Acao nao permitida')).toBeTruthy();
      });
      expect(screen.queryByText('Salvar gasto')).toBeNull();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });

    it.each(['FECHADO', 'ARQUIVADO', 'CANCELADO'] as const)(
      'bloqueia criacao em planejamento %s',
      async (status) => {
        mockGetPlanejamentoById.mockResolvedValue(
          makePlanejamento({ status }),
        );

        render(<PlanejamentoGastoFormScreen />);

        await waitFor(() => {
          expect(
            screen.getByText(
              'Apenas planejamentos abertos permitem criar ou editar gastos.',
            ),
          ).toBeTruthy();
        });
        expect(screen.queryByText('Salvar gasto')).toBeNull();
        expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
      },
    );

    it('mantem o formulario inoperante enquanto a autorizacao carrega', async () => {
      const planejamentoDeferred = createDeferred<Planejamento>();
      mockGetPlanejamentoById.mockReturnValue(planejamentoDeferred.promise);

      render(<PlanejamentoGastoFormScreen />);

      expect(screen.getByText('Carregando participantes...')).toBeTruthy();
      expect(screen.queryByPlaceholderText('Ex.: Hospedagem')).toBeNull();
      expect(screen.queryByText('Salvar gasto')).toBeNull();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();

      await act(async () => {
        planejamentoDeferred.resolve(makePlanejamento());
      });
      await waitFor(() => {
        expect(screen.getByText('Salvar gasto')).toBeTruthy();
      });
    });

    it('mostra adicionar participante somente ao owner aberto sem opcoes', async () => {
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ participantes: [] }),
      );

      const view = render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(screen.getByText('Adicionar participante')).toBeTruthy();
      });

      mockLocalSearchParams = { id: 'planejamento-2' };
      mockGetUser.mockResolvedValue(makeUser('usuario-sem-vinculo'));
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({
          id: 'planejamento-2',
          participantes: [],
          usuarioCriadorId: 'usuario-owner',
        }),
      );
      view.rerender(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(screen.getByText('Acao nao permitida')).toBeTruthy();
      });
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('serializa duplo envio de criacao', async () => {
      const creationDeferred = createDeferred<GastoPlanejamento>();
      mockCreateGastoPlanejamento.mockReturnValue(creationDeferred.promise);
      await renderReady();

      fillRequiredExpenseFields();
      fireEvent.press(screen.getByTestId('payer-participante-1'));
      fireEvent.press(screen.getByTestId('split-participante-1'));
      const saveButton = screen.getByText('Salvar gasto');
      fireEvent.press(saveButton);
      fireEvent.press(saveButton);

      expect(mockCreateGastoPlanejamento).toHaveBeenCalledTimes(1);

      await act(async () => {
        creationDeferred.resolve(makeGasto());
      });
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/planejamentos-detail',
          params: { id: 'planejamento-1' },
        });
      });
    });
  });

  describe('autorizacao de edicao', () => {
    beforeEach(() => {
      mockLocalSearchParams = {
        gastoId: 'gasto-1',
        id: 'planejamento-1',
      };
      mockGetGastoPlanejamentoById.mockResolvedValue(
        makeGastoWithActiveDivision(),
      );
    });

    it('permite edicao somente ao owner com planejamento aberto e gasto ativo', async () => {
      const updateDeferred = createDeferred<GastoPlanejamento>();
      mockUpdateGastoPlanejamento.mockReturnValue(updateDeferred.promise);
      await renderEditReady();

      fireEvent.press(screen.getByText('Salvar alteracoes'));
      expect(mockUpdateGastoPlanejamento).toHaveBeenCalledTimes(1);

      await act(async () => {
        updateDeferred.resolve(makeGasto());
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/planejamentos-detail',
          params: { id: 'planejamento-1' },
        });
      });
    });

    it('bloqueia deep link de edicao para participante vinculado ativo', async () => {
      mockGetUser.mockResolvedValue(makeUser('usuario-actor'));
      mockGetPlanejamentoById.mockResolvedValue(
        makeActiveLinkedActorPlanejamento({
          participantes: [
            makeParticipante({
              id: 'participante-1',
              tipo: 'VINCULADO',
              usuarioId: 'usuario-actor',
            }),
          ],
        }),
      );

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Somente o proprietario pode editar gastos deste planejamento.',
          ),
        ).toBeTruthy();
      });
      expect(screen.queryByPlaceholderText('Ex.: Hospedagem')).toBeNull();
      expect(screen.queryByText('Salvar alteracoes')).toBeNull();
      expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
    });

    it('bloqueia deep link de edicao para usuario nao vinculado', async () => {
      mockGetUser.mockResolvedValue(makeUser('usuario-sem-vinculo'));
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ usuarioCriadorId: 'usuario-owner' }),
      );

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(screen.getByText('Acao nao permitida')).toBeTruthy();
      });
      expect(screen.queryByText('Salvar alteracoes')).toBeNull();
      expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
    });

    it.each(['FECHADO', 'ARQUIVADO'] as const)(
      'bloqueia edicao do owner em planejamento %s',
      async (status) => {
        mockGetPlanejamentoById.mockResolvedValue(
          makePlanejamento({ status }),
        );

        render(<PlanejamentoGastoFormScreen />);

        await waitFor(() => {
          expect(screen.getByText('Formulario indisponivel')).toBeTruthy();
        });
        expect(screen.queryByText('Salvar alteracoes')).toBeNull();
        expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
      },
    );
  });

  describe('isolamento assincrono entre rotas', () => {
    it('descarta resposta antiga ao trocar gastoId', async () => {
      const gastoAntigo = createDeferred<GastoPlanejamento>();
      const gastoAtual = createDeferred<GastoPlanejamento>();
      mockLocalSearchParams = {
        gastoId: 'gasto-antigo',
        id: 'planejamento-1',
      };
      mockGetGastoPlanejamentoById.mockImplementation(
        (_planejamentoId, requestedGastoId) =>
          requestedGastoId === 'gasto-antigo'
            ? gastoAntigo.promise
            : gastoAtual.promise,
      );

      const view = render(<PlanejamentoGastoFormScreen />);
      mockLocalSearchParams = {
        gastoId: 'gasto-atual',
        id: 'planejamento-1',
      };
      view.rerender(<PlanejamentoGastoFormScreen />);

      await act(async () => {
        gastoAtual.resolve(
          makeGastoWithActiveDivision({
            descricao: 'Gasto atual',
            id: 'gasto-atual',
          }),
        );
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ex.: Hospedagem').props.value).toBe(
          'Gasto atual',
        );
      });

      await act(async () => {
        gastoAntigo.resolve(
          makeGastoWithActiveDivision({
            descricao: 'Gasto obsoleto',
            id: 'gasto-antigo',
          }),
        );
      });
      expect(screen.getByPlaceholderText('Ex.: Hospedagem').props.value).toBe(
        'Gasto atual',
      );
    });

    it('invalida autorizacao antiga ao trocar planejamentoId', async () => {
      const planejamentoAntigo = createDeferred<Planejamento>();
      mockGetPlanejamentoById.mockImplementation((requestedId) =>
        requestedId === 'planejamento-1'
          ? planejamentoAntigo.promise
          : Promise.resolve(
              makePlanejamento({
                id: 'planejamento-2',
                status: 'FECHADO',
              }),
            ),
      );
      const view = render(<PlanejamentoGastoFormScreen />);

      mockLocalSearchParams = { id: 'planejamento-2' };
      view.rerender(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Apenas planejamentos abertos permitem criar ou editar gastos.',
          ),
        ).toBeTruthy();
      });
      await act(async () => {
        planejamentoAntigo.resolve(makePlanejamento());
      });

      expect(screen.queryByText('Salvar gasto')).toBeNull();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
    });

    it('protege a sequencia A para B para A com geracoes distintas', async () => {
      const primeiraCargaA = createDeferred<Planejamento>();
      const cargaB = createDeferred<Planejamento>();
      const segundaCargaA = createDeferred<Planejamento>();
      let chamadasA = 0;
      mockGetPlanejamentoById.mockImplementation((requestedId) => {
        if (requestedId === 'planejamento-b') {
          return cargaB.promise;
        }

        chamadasA += 1;
        return chamadasA === 1
          ? primeiraCargaA.promise
          : segundaCargaA.promise;
      });
      mockLocalSearchParams = { id: 'planejamento-a' };
      const view = render(<PlanejamentoGastoFormScreen />);

      mockLocalSearchParams = { id: 'planejamento-b' };
      view.rerender(<PlanejamentoGastoFormScreen />);
      mockLocalSearchParams = { id: 'planejamento-a' };
      view.rerender(<PlanejamentoGastoFormScreen />);

      await act(async () => {
        segundaCargaA.resolve(
          makePlanejamento({
            id: 'planejamento-a',
            participantes: [
              makeParticipante({
                id: 'participante-a-atual',
                planejamentoId: 'planejamento-a',
              }),
            ],
          }),
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('payer-participante-a-atual')).toBeTruthy();
      });

      await act(async () => {
        primeiraCargaA.resolve(
          makePlanejamento({
            id: 'planejamento-a',
            participantes: [],
            status: 'FECHADO',
          }),
        );
        cargaB.resolve(
          makePlanejamento({ id: 'planejamento-b', participantes: [] }),
        );
      });

      expect(screen.getByTestId('payer-participante-a-atual')).toBeTruthy();
      expect(screen.getByText('Salvar gasto')).toBeTruthy();
    });

    it('nao navega quando sucesso de edicao pertence a gasto antigo', async () => {
      const updateDeferred = createDeferred<GastoPlanejamento>();
      mockUpdateGastoPlanejamento.mockReturnValue(updateDeferred.promise);
      mockLocalSearchParams = {
        gastoId: 'gasto-1',
        id: 'planejamento-1',
      };
      mockGetGastoPlanejamentoById.mockImplementation(
        (_planejamentoId, requestedGastoId) =>
          Promise.resolve(
            makeGastoWithActiveDivision({ id: requestedGastoId }),
          ),
      );
      const view = render(<PlanejamentoGastoFormScreen />);
      await waitFor(() => {
        expect(screen.getByText('Salvar alteracoes')).toBeTruthy();
      });
      fireEvent.press(screen.getByText('Salvar alteracoes'));
      expect(mockUpdateGastoPlanejamento).toHaveBeenCalledTimes(1);

      mockLocalSearchParams = {
        gastoId: 'gasto-2',
        id: 'planejamento-1',
      };
      view.rerender(<PlanejamentoGastoFormScreen />);
      await waitFor(() => {
        expect(mockGetGastoPlanejamentoById).toHaveBeenCalledWith(
          'planejamento-1',
          'gasto-2',
        );
      });

      await act(async () => {
        updateDeferred.resolve(makeGasto({ id: 'gasto-1' }));
      });
      expect(mockReplace).not.toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });

    it('nao redireciona por unauthorized obsoleto de carga anterior', async () => {
      const cargaAntiga = createDeferred<Planejamento>();
      mockGetPlanejamentoById.mockImplementation((requestedId) =>
        requestedId === 'planejamento-1'
          ? cargaAntiga.promise
          : Promise.resolve(makePlanejamento({ id: 'planejamento-2' })),
      );
      const view = render(<PlanejamentoGastoFormScreen />);

      mockLocalSearchParams = { id: 'planejamento-2' };
      view.rerender(<PlanejamentoGastoFormScreen />);
      await waitFor(() => {
        expect(screen.getByText('Salvar gasto')).toBeTruthy();
      });

      await act(async () => {
        cargaAntiga.reject({ response: { status: 401 } });
      });
      await settleAsyncWork();

      expect(mockReplace).not.toHaveBeenCalledWith('/login');
      expect(screen.getByText('Salvar gasto')).toBeTruthy();
    });

    it('redireciona por unauthorized somente quando pertence a rota atual', async () => {
      mockGetPlanejamentoById.mockRejectedValue({
        response: { data: { message: 'Unauthorized' }, status: 401 },
      });

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
        expect(screen.getByText('Sessao expirada')).toBeTruthy();
      });
      expect(screen.queryByText('Salvar gasto')).toBeNull();
    });

    it('trata identidade ausente como sessao expirada da rota atual', async () => {
      mockGetUser.mockResolvedValue(null);

      render(<PlanejamentoGastoFormScreen />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
        expect(screen.getByText('Sessao expirada')).toBeTruthy();
        expect(
          screen.getByText('Sessao expirada. Faca login novamente.'),
        ).toBeTruthy();
      });
      expect(screen.queryByText('Salvar gasto')).toBeNull();
      expect(mockCreateGastoPlanejamento).not.toHaveBeenCalled();
      expect(mockUpdateGastoPlanejamento).not.toHaveBeenCalled();
    });

    it('ignora resposta recebida depois do unmount', async () => {
      const cargaPendente = createDeferred<Planejamento>();
      mockGetPlanejamentoById.mockReturnValue(cargaPendente.promise);
      const view = render(<PlanejamentoGastoFormScreen />);

      view.unmount();
      await act(async () => {
        cargaPendente.reject({ response: { status: 401 } });
      });
      await settleAsyncWork();

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
