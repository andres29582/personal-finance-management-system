import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentoGastoFormScreen } from '../screens/PlanejamentoGastoFormScreen';
import * as planejamentoService from '../services/planejamentoService';
import { GastoPlanejamento, Planejamento } from '../types/planejamento';

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

async function renderReady() {
  render(<PlanejamentoGastoFormScreen />);

  await waitFor(() => {
    expect(screen.getByText('Salvar gasto')).toBeTruthy();
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
