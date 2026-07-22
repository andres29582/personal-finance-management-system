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

describe('PlanejamentoGastoFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
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

    await renderEditReady();

    expect(
      screen.getByText(
        'Apenas planejamentos abertos permitem criar ou editar gastos.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Salvar alteracoes' }).props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(screen.getByText('Salvar alteracoes'));
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

      await renderEditReady();

      expect(
        screen.getByText('Apenas gastos ativos podem ser editados.'),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Salvar alteracoes' }).props
          .accessibilityState,
      ).toEqual(expect.objectContaining({ disabled: true }));
      fireEvent.press(screen.getByText('Salvar alteracoes'));
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
});
