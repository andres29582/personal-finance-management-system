import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { getUser } from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import { PlanejamentoDetailScreen } from '../screens/PlanejamentoDetailScreen';
import * as planejamentoService from '../services/planejamentoService';
import {
  AcertoPlanejamento,
  GastoPlanejamento,
  ParticipantePlanejamento,
  Planejamento,
  ResumoFinanceiroPlanejamento,
} from '../types/planejamento';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { id: 'planejamento-1' };
const LINKED_USER_ID = 'usuario-2';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/planejamentoService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockConfirmAction = confirmAction as jest.MockedFunction<
  typeof confirmAction
>;
const mockGetPlanejamentoById =
  planejamentoService.getPlanejamentoById as jest.MockedFunction<
    typeof planejamentoService.getPlanejamentoById
  >;
const mockGetResumoPlanejamento =
  planejamentoService.getResumoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.getResumoPlanejamento
  >;
const mockListGastosPlanejamento =
  planejamentoService.listGastosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listGastosPlanejamento
  >;
const mockListAcertosPlanejamento =
  planejamentoService.listAcertosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.listAcertosPlanejamento
  >;
const mockSyncAcertosPlanejamento =
  planejamentoService.syncAcertosPlanejamento as jest.MockedFunction<
    typeof planejamentoService.syncAcertosPlanejamento
  >;
const mockPayAcertoPlanejamento =
  planejamentoService.payAcertoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.payAcertoPlanejamento
  >;
const mockCancelGastoPlanejamento =
  planejamentoService.cancelGastoPlanejamento as jest.MockedFunction<
    typeof planejamentoService.cancelGastoPlanejamento
  >;
const mockFecharPlanejamento =
  planejamentoService.fecharPlanejamento as jest.MockedFunction<
    typeof planejamentoService.fecharPlanejamento
  >;
const mockRemoveParticipantePlanejamento =
  planejamentoService.removeParticipantePlanejamento as jest.MockedFunction<
    typeof planejamentoService.removeParticipantePlanejamento
  >;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-01-20',
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    id: 'planejamento-1',
    nome: 'Viagem de ferias',
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

function makeGasto(
  overrides: Partial<GastoPlanejamento> = {},
): GastoPlanejamento {
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
    pagoPorParticipante: {
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
    email: 'bruno@example.com',
    id: 'participante-2',
    nome: 'Bruno',
    planejamentoId: 'planejamento-1',
    status: 'ATIVO',
    tipo: 'MANUAL',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: null,
    ...overrides,
  };
}

function makeOwnerParticipante(): ParticipantePlanejamento {
  return makeParticipante({
    email: 'ana@example.com',
    id: 'participante-1',
    nome: 'Ana',
    tipo: 'VINCULADO',
    usuarioId: 'usuario-1',
  });
}

function makeLinkedParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return makeParticipante({
    id: 'participante-2',
    tipo: 'VINCULADO',
    usuarioId: LINKED_USER_ID,
    ...overrides,
  });
}

function makePlanejamentoComVinculado(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return makePlanejamento({
    participantes: [makeOwnerParticipante(), makeLinkedParticipante()],
    ...overrides,
  });
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
    obrigacaoResidualCentavos: 0,
    participantes: [],
    planejamentoId: 'planejamento-1',
    situacaoFinanceira: 'QUITADO',
    statusOperacional: 'ABERTO',
    totalGastosAtivosCentavos: 0,
    ...overrides,
  };
}

describe('PlanejamentoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockGetUser.mockResolvedValue({
      email: 'ana@example.com',
      id: 'usuario-1',
      nome: 'Ana',
    });
    mockConfirmAction.mockResolvedValue(true);
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockGetResumoPlanejamento.mockResolvedValue(makeResumo());
    mockListGastosPlanejamento.mockResolvedValue([]);
    mockListAcertosPlanejamento.mockResolvedValue([]);
    mockSyncAcertosPlanejamento.mockResolvedValue([]);
    mockPayAcertoPlanejamento.mockResolvedValue(
      makeAcerto({
        dataPagamento: '2026-01-15T00:00:00.000Z',
        status: 'PAGO',
      }),
    );
    mockCancelGastoPlanejamento.mockResolvedValue(
      makeGasto({ status: 'CANCELADO' }),
    );
    mockFecharPlanejamento.mockResolvedValue(
      makePlanejamento({ status: 'FECHADO' }),
    );
    mockRemoveParticipantePlanejamento.mockResolvedValue(
      makeParticipante({ status: 'REMOVIDO' }),
    );
  });

  it('carrega e compoe as seis secoes do detalhe', async () => {
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(
      () => {
        expect(screen.getByText('Ciclo de vida')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
    expect(mockGetResumoPlanejamento).toHaveBeenCalledWith('planejamento-1');
    expect(mockListGastosPlanejamento).toHaveBeenCalledWith('planejamento-1');
    expect(mockListAcertosPlanejamento).toHaveBeenCalledWith(
      'planejamento-1',
    );
    expect(screen.getAllByText('Viagem de ferias')).toBeTruthy();
    expect(screen.getByText('Custos compartilhados')).toBeTruthy();
    expect(screen.getByText('Resumo financeiro')).toBeTruthy();
    expect(screen.getByText('Participantes')).toBeTruthy();
    expect(screen.getByText('Gastos')).toBeTruthy();
    expect(screen.getByText('Acertos')).toBeTruthy();
    expect(screen.getByText('Hotel')).toBeTruthy();
    expect(
      screen.getByText('12/01/2026 - Eventual - Hospedagem'),
    ).toBeTruthy();
    expect(screen.getByText('Pago por Ana')).toBeTruthy();
    expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
    expect(screen.getByText('Devedor: Bruno')).toBeTruthy();
    expect(screen.getByText('Recebedor: Ana')).toBeTruthy();
  });

  it('renderiza o resumo financeiro oficial e os saldos dos participantes', async () => {
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 5000,
        participantes: [
          {
            participante: {
              id: 'participante-1',
              nome: 'Ana',
              status: 'ATIVO',
              tipo: 'VINCULADO',
            },
            saldoAbertoCentavos: 5000,
            saldoBrutoCentavos: 5000,
            statusFinanceiro: 'RECEBEDOR',
            totalDevidoCentavos: 5001,
            totalPagoCentavos: 10001,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
          {
            participante: {
              id: 'participante-2',
              nome: 'Bruno',
              status: 'ATIVO',
              tipo: 'MANUAL',
            },
            saldoAbertoCentavos: -5000,
            saldoBrutoCentavos: -5000,
            statusFinanceiro: 'DEVEDOR',
            totalDevidoCentavos: 5000,
            totalPagoCentavos: 0,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
          {
            participante: {
              id: 'participante-3',
              nome: 'Carla',
              status: 'ATIVO',
              tipo: 'MANUAL',
            },
            saldoAbertoCentavos: 0,
            saldoBrutoCentavos: 0,
            statusFinanceiro: 'QUITADO',
            totalDevidoCentavos: 0,
            totalPagoCentavos: 0,
            totalPagoEmAcertosCentavos: 0,
            totalRecebidoEmAcertosCentavos: 0,
          },
        ],
        situacaoFinanceira: 'PENDENTE',
        totalGastosAtivosCentavos: 10001,
      }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Situacao financeira')).toBeTruthy();
      expect(screen.getByText('Pendente')).toBeTruthy();
      expect(screen.getByText('Total de gastos ativos')).toBeTruthy();
      expect(screen.getByText(/100,01/)).toBeTruthy();
      expect(screen.getByText('Obrigacao residual')).toBeTruthy();
      expect(screen.getAllByText(/50,00/)).toHaveLength(3);
      expect(screen.getByText('RECEBEDOR')).toBeTruthy();
      expect(screen.getByText('DEVEDOR')).toBeTruthy();
      expect(screen.getByText('QUITADO')).toBeTruthy();
      expect(screen.getByText('Carla')).toBeTruthy();
    });
  });

  it('aplica a matriz visual de um planejamento aberto e quitado', async () => {
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);
    mockListAcertosPlanejamento.mockResolvedValue([
      makeAcerto({ id: 'acerto-pendente' }),
      makeAcerto({ id: 'acerto-pago', status: 'PAGO' }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Adicionar participante')).toBeTruthy();
      expect(screen.getByText('Remover participante')).toBeTruthy();
      expect(screen.getByText('Adicionar gasto')).toBeTruthy();
      expect(screen.getByText('Editar')).toBeTruthy();
      expect(screen.getByText('Cancelar gasto')).toBeTruthy();
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
      expect(screen.getAllByText('Cancelar')).toHaveLength(2);
      expect(screen.getByText('Reabrir')).toBeTruthy();
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
      expect(screen.getByText('Cancelar planejamento')).toBeTruthy();
      expect(screen.queryByText('Arquivar planejamento')).toBeNull();
    });
  });

  it('permite ao participante vinculado criar gasto sem expor acoes do proprietario', async () => {
    mockGetUser.mockResolvedValue({
      email: 'bruno@example.com',
      id: LINKED_USER_ID,
      nome: 'Bruno',
    });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamentoComVinculado());
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Adicionar gasto')).toBeTruthy();
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(screen.queryByText('Remover participante')).toBeNull();
      expect(screen.queryByText('Editar')).toBeNull();
      expect(screen.queryByText('Cancelar gasto')).toBeNull();
      expect(screen.queryByText('Fechar planejamento')).toBeNull();
      expect(screen.queryByText('Arquivar planejamento')).toBeNull();
      expect(screen.queryByText('Cancelar planejamento')).toBeNull();
    });

    fireEvent.press(screen.getByText('Adicionar gasto'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-gasto-form',
      params: { id: 'planejamento-1' },
    });
  });

  it('limita as acoes de acerto do vinculado ao pagamento da propria divida', async () => {
    const acertoProprio = makeAcerto({ id: 'acerto-proprio' });
    const acertoDeOutro = makeAcerto({
      deParticipante: {
        id: 'participante-1',
        nome: 'Ana',
      },
      deParticipanteId: 'participante-1',
      id: 'acerto-de-outro',
      paraParticipante: {
        id: 'participante-2',
        nome: 'Bruno',
      },
      paraParticipanteId: 'participante-2',
    });
    mockGetUser.mockResolvedValue({
      email: 'bruno@example.com',
      id: LINKED_USER_ID,
      nome: 'Bruno',
    });
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamentoComVinculado());
    mockListAcertosPlanejamento.mockResolvedValue([
      acertoProprio,
      acertoDeOutro,
      makeAcerto({ id: 'acerto-pago', status: 'PAGO' }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      expect(screen.getAllByText('Marcar como pago')).toHaveLength(1);
      expect(screen.queryByText('Cancelar')).toBeNull();
      expect(screen.queryByText('Reabrir')).toBeNull();
    });

    fireEvent.press(screen.getByText('Marcar como pago'));

    await waitFor(() => {
      expect(mockPayAcertoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        acertoProprio.id,
      );
      expect(
        screen.getByText('Acerto atualizado com sucesso.'),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sincronizar acertos'));

    await waitFor(() => {
      expect(mockSyncAcertosPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
      );
    });
  });

  it('mantem o cancelamento aberto indisponivel enquanto houver pendencia financeira', async () => {
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 100,
        situacaoFinanceira: 'PENDENTE',
      }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'O cancelamento fica disponivel quando a situacao financeira estiver quitada.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar planejamento'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('bloqueia mutacoes estruturais no fechado e mantem os acertos disponiveis', async () => {
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ status: 'FECHADO' }),
    );
    mockGetResumoPlanejamento.mockResolvedValue(
      makeResumo({
        obrigacaoResidualCentavos: 5000,
        situacaoFinanceira: 'PENDENTE',
        statusOperacional: 'FECHADO',
      }),
    );
    mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(screen.queryByText('Adicionar gasto')).toBeNull();
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
      expect(screen.getByText('Cancelar')).toBeTruthy();
      expect(screen.queryByText('Fechar planejamento')).toBeNull();
      expect(screen.getByText('Arquivar planejamento')).toBeTruthy();
      expect(
        screen.getByText(
          'Quite a obrigacao residual para arquivar o planejamento.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Arquivar planejamento'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it.each(['ARQUIVADO', 'CANCELADO'] as const)(
    'torna o planejamento %s totalmente somente leitura',
    async (status) => {
      mockGetPlanejamentoById.mockResolvedValue(makePlanejamento({ status }));
      mockGetResumoPlanejamento.mockResolvedValue(
        makeResumo({ statusOperacional: status }),
      );
      mockListAcertosPlanejamento.mockResolvedValue([makeAcerto()]);

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(
          screen.getByText('Este planejamento esta em modo somente leitura.'),
        ).toBeTruthy();
        expect(screen.queryByText('Adicionar participante')).toBeNull();
        expect(screen.queryByText('Adicionar gasto')).toBeNull();
        expect(screen.queryByText('Sincronizar acertos')).toBeNull();
        expect(screen.queryByText('Marcar como pago')).toBeNull();
        expect(screen.queryByText('Cancelar')).toBeNull();
        expect(screen.queryByText('Reabrir')).toBeNull();
        expect(screen.queryByText('Fechar planejamento')).toBeNull();
        expect(screen.queryByText('Arquivar planejamento')).toBeNull();
        expect(screen.queryByText('Cancelar planejamento')).toBeNull();
      });
    },
  );

  it('mostra os empty states das colecoes do detalhe', async () => {
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({ participantes: [] }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum participante cadastrado.')).toBeTruthy();
      expect(screen.getByText('Nenhum gasto cadastrado.')).toBeTruthy();
      expect(
        screen.getByText(
          'Nenhum acerto encontrado. Cadastre gastos e participantes ativos para calcular os acertos.',
        ),
      ).toBeTruthy();
    });
  });

  it('exibe remocao apenas para participante ativo que nao e o proprietario', async () => {
    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      const ownerRow = screen.getByTestId('participante-row-participante-1');
      const removableRow = screen.getByTestId(
        'participante-row-participante-2',
      );

      expect(within(ownerRow).getByText('Proprietário')).toBeTruthy();
      expect(
        within(ownerRow).queryByRole('button', {
          name: 'Remover participante',
        }),
      ).toBeNull();
      expect(
        within(removableRow).getByRole('button', {
          name: 'Remover participante',
        }),
      ).toBeTruthy();
    });
  });

  it.each([
    { status: 'REMOVIDO', statusText: 'Removido' },
    { status: 'PENDENTE', statusText: 'Pendente' },
  ] as const)(
    'mantem participante $status visivel sem acao de remocao',
    async ({ status, statusText }) => {
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({
          participantes: [
            makeOwnerParticipante(),
            makeParticipante({ status }),
          ],
        }),
      );

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bruno')).toBeTruthy();
        expect(screen.getByText(statusText)).toBeTruthy();
        expect(screen.queryByText('Remover participante')).toBeNull();
      });
    },
  );

  it('nao exibe remocao quando o usuario autenticado nao e o proprietario', async () => {
    mockGetUser.mockResolvedValue({
      email: 'convidado@example.com',
      id: 'usuario-2',
      nome: 'Convidado',
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno')).toBeTruthy();
      expect(screen.queryByText('Remover participante')).toBeNull();
    });
  });

  it('nao exibe remocao quando nao existe usuario armazenado', async () => {
    mockGetUser.mockResolvedValue(null);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno')).toBeTruthy();
      expect(screen.queryByText('Remover participante')).toBeNull();
      expect(
        screen.queryByText(
          'Não foi possível verificar sua permissão para gerenciar participantes.',
        ),
      ).toBeNull();
    });
  });

  it('mantem a tela carregada quando a leitura do usuario falha', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('SecureStore indisponivel'));

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno')).toBeTruthy();
      expect(
        screen.getByText(
          'Não foi possível verificar sua permissão para gerenciar participantes.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText('Nao foi possivel carregar o planejamento'),
      ).toBeNull();
      expect(screen.queryByText('Remover participante')).toBeNull();
    });
  });

  it('nao exibe remocao antes de a identidade ser carregada', async () => {
    let resolveUser: (
      user: Awaited<ReturnType<typeof getUser>>,
    ) => void = () => undefined;
    mockGetUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUser = resolve;
        }),
    );

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno')).toBeTruthy();
      expect(screen.queryByText('Remover participante')).toBeNull();
    });

    await act(async () => {
      resolveUser({
        email: 'ana@example.com',
        id: 'usuario-1',
        nome: 'Ana',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Remover participante')).toBeTruthy();
    });
  });

  it.each([
    {
      label: 'Adicionar participante',
      pathname: '/planejamentos-participante-form',
    },
    {
      label: 'Adicionar gasto',
      pathname: '/planejamentos-gasto-form',
    },
  ] as const)('navega por $label', async ({ label, pathname }) => {
    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText(label)).toBeTruthy();
    });

    fireEvent.press(screen.getByText(label));

    expect(mockPush).toHaveBeenCalledWith({
      pathname,
      params: { id: 'planejamento-1' },
    });
  });

  it('abre a edicao com planejamentoId e gastoId', async () => {
    mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Editar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Editar'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/planejamentos-gasto-form',
      params: { gastoId: 'gasto-1', id: 'planejamento-1' },
    });
  });

  it('navega de volta para a lista', async () => {
    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Voltar')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Voltar'));

    expect(mockPush).toHaveBeenCalledWith('/planejamentos');
  });

  it('mostra status de gasto e acoes somente para a linha ativa', async () => {
    mockListGastosPlanejamento.mockResolvedValue([
      makeGasto({ id: 'gasto-ativo', status: 'ATIVO' }),
      makeGasto({
        descricao: 'Hotel cancelado',
        id: 'gasto-cancelado',
        status: 'CANCELADO',
      }),
      makeGasto({
        descricao: 'Hotel em revisao',
        id: 'gasto-revisao',
        status: 'PENDENTE_REVISAO',
      }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('ATIVO')).toBeTruthy();
      expect(screen.getByText('CANCELADO')).toBeTruthy();
      expect(screen.getByText('PENDENTE_REVISAO')).toBeTruthy();
      expect(screen.getAllByText('Editar')).toHaveLength(1);
      expect(screen.getAllByText('Cancelar gasto')).toHaveLength(1);
    });
  });

  it.each(['FECHADO', 'ARQUIVADO', 'CANCELADO'] as const)(
    'mantem linhas de gasto sem acoes no planejamento %s',
    async (status) => {
      mockGetPlanejamentoById.mockResolvedValue(makePlanejamento({ status }));
      mockGetResumoPlanejamento.mockResolvedValue(
        makeResumo({ statusOperacional: status }),
      );
      mockListGastosPlanejamento.mockResolvedValue([makeGasto()]);

      render(<PlanejamentoDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('ATIVO')).toBeTruthy();
        expect(screen.queryByText('Editar')).toBeNull();
        expect(screen.queryByText('Cancelar gasto')).toBeNull();
      });
    },
  );

  it('mostra os dados oficiais de um acerto pago', async () => {
    mockListAcertosPlanejamento.mockResolvedValue([
      makeAcerto({
        dataPagamento: '2026-01-15T00:00:00.000Z',
        observacao: 'Pix confirmado',
        status: 'PAGO',
      }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
      expect(screen.getByText('Pago')).toBeTruthy();
      expect(screen.getByText('Pago em 15/01/2026')).toBeTruthy();
      expect(screen.getByText('Observacao: Pix confirmado')).toBeTruthy();
      expect(screen.getByText(/50,00/)).toBeTruthy();
    });
  });

  it('mostra a matriz de acoes conforme o status do acerto', async () => {
    mockListAcertosPlanejamento.mockResolvedValue([
      makeAcerto({ id: 'acerto-pendente', status: 'PENDENTE' }),
      makeAcerto({ id: 'acerto-pago', status: 'PAGO' }),
      makeAcerto({ id: 'acerto-cancelado', status: 'CANCELADO' }),
      makeAcerto({ id: 'acerto-confirmado', status: 'CONFIRMADO' }),
    ]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Confirmado')).toBeTruthy();
      expect(screen.getAllByText('Marcar como pago')).toHaveLength(1);
      expect(screen.getAllByText('Cancelar')).toHaveLength(2);
      expect(screen.getAllByText('Reabrir')).toHaveLength(1);
    });
  });

  it('integra a remocao de participante com o controlador de mutacoes', async () => {
    const participanteRemovido = makeParticipante({ status: 'REMOVIDO' });
    mockGetPlanejamentoById
      .mockResolvedValueOnce(makePlanejamento())
      .mockResolvedValueOnce(
        makePlanejamento({
          participantes: [makeOwnerParticipante(), participanteRemovido],
        }),
      );
    mockRemoveParticipantePlanejamento.mockResolvedValue(participanteRemovido);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Remover participante')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Remover participante'));

    await waitFor(() => {
      expect(mockRemoveParticipantePlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'participante-2',
      );
      expect(
        screen.getByText('Participante removido com sucesso.'),
      ).toBeTruthy();
      expect(screen.getByText('Removido')).toBeTruthy();
    });
  });

  it('integra o cancelamento de gasto com o controlador de mutacoes', async () => {
    const gastoCancelado = makeGasto({ status: 'CANCELADO' });
    mockListGastosPlanejamento
      .mockResolvedValueOnce([makeGasto()])
      .mockResolvedValueOnce([gastoCancelado]);
    mockCancelGastoPlanejamento.mockResolvedValue(gastoCancelado);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Cancelar gasto')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Cancelar gasto'));

    await waitFor(() => {
      expect(mockCancelGastoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'gasto-1',
      );
      expect(screen.getByText('Gasto cancelado com sucesso.')).toBeTruthy();
      expect(screen.getByText('CANCELADO')).toBeTruthy();
    });
  });

  it('integra o lifecycle com o controlador de mutacoes', async () => {
    const planejamentoFechado = makePlanejamento({ status: 'FECHADO' });
    mockGetPlanejamentoById
      .mockResolvedValueOnce(makePlanejamento())
      .mockResolvedValueOnce(planejamentoFechado);
    mockGetResumoPlanejamento
      .mockResolvedValueOnce(makeResumo())
      .mockResolvedValueOnce(
        makeResumo({ statusOperacional: 'FECHADO' }),
      );
    mockFecharPlanejamento.mockResolvedValue(planejamentoFechado);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar planejamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Fechar planejamento'));

    await waitFor(() => {
      expect(mockFecharPlanejamento).toHaveBeenCalledWith('planejamento-1');
      expect(
        screen.getByText('Planejamento fechado com sucesso.'),
      ).toBeTruthy();
      expect(screen.getByText('Arquivar planejamento')).toBeTruthy();
      expect(screen.queryByText('Adicionar participante')).toBeNull();
      expect(screen.queryByText('Adicionar gasto')).toBeNull();
    });
  });

  it('integra a sincronizacao de acertos com o controlador de mutacoes', async () => {
    const acerto = makeAcerto();
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([acerto]);
    mockSyncAcertosPlanejamento.mockResolvedValue([acerto]);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sincronizar acertos')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sincronizar acertos'));

    await waitFor(() => {
      expect(mockSyncAcertosPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
      );
      expect(
        screen.getByText('Acertos sincronizados com sucesso.'),
      ).toBeTruthy();
      expect(screen.getByText('Bruno deve pagar Ana')).toBeTruthy();
    });
  });

  it('integra uma acao de acerto com o controlador de mutacoes', async () => {
    const acertoPago = makeAcerto({
      dataPagamento: '2026-01-15T00:00:00.000Z',
      status: 'PAGO',
    });
    mockListAcertosPlanejamento
      .mockResolvedValueOnce([makeAcerto()])
      .mockResolvedValueOnce([acertoPago]);
    mockPayAcertoPlanejamento.mockResolvedValue(acertoPago);

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Marcar como pago')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Marcar como pago'));

    await waitFor(() => {
      expect(mockPayAcertoPlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        'acerto-1',
      );
      expect(screen.getByText('Acerto atualizado com sucesso.')).toBeTruthy();
      expect(screen.getByText('Pago')).toBeTruthy();
      expect(screen.getByText('Reabrir')).toBeTruthy();
    });
  });

  it('trata erro de API durante a leitura do agregado', async () => {
    mockGetResumoPlanejamento.mockRejectedValueOnce({
      response: {
        data: { message: 'Resumo financeiro indisponivel.' },
        status: 500,
      },
    });

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Resumo financeiro indisponivel.')).toBeTruthy();
      expect(
        screen.getByText('Nao foi possivel carregar o planejamento'),
      ).toBeTruthy();
    });
  });

  it('mostra erro quando id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
      expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
    });
  });
});
