import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentoFormScreen } from '../screens/PlanejamentoFormScreen';
import * as planejamentoService from '../services/planejamentoService';
import { Planejamento } from '../types/planejamento';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../services/planejamentoService');

const mockCreatePlanejamento =
  planejamentoService.createPlanejamento as jest.MockedFunction<
    typeof planejamentoService.createPlanejamento
  >;

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: '2026-02-20',
    dataInicio: '2026-02-10',
    deletedAt: null,
    descricao: 'Custos da viagem',
    id: 'planejamento-1',
    nome: 'Viagem Nordeste',
    participantes: [],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: 'usuario-1',
    ...overrides,
  };
}

describe('PlanejamentoFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cria planejamento e navega para o detalhe', async () => {
    mockCreatePlanejamento.mockResolvedValue(makePlanejamento());

    render(<PlanejamentoFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Ex.: Viagem de ferias'),
      'Viagem Nordeste',
    );
    fireEvent.press(screen.getByText('Viagem'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Contexto, combinados ou observacoes'),
      'Custos da viagem',
    );
    const dateInputs = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(dateInputs[0], '2026-02-10');
    fireEvent.changeText(dateInputs[1], '2026-02-20');
    fireEvent.press(screen.getByText('Criar planejamento'));

    await waitFor(() => {
      expect(mockCreatePlanejamento).toHaveBeenCalledWith({
        dataFim: '2026-02-20',
        dataInicio: '2026-02-10',
        descricao: 'Custos da viagem',
        nome: 'Viagem Nordeste',
        tipo: 'VIAGEM',
      });
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('bloqueia criacao sem nome', async () => {
    render(<PlanejamentoFormScreen />);

    fireEvent.press(screen.getByText('Criar planejamento'));

    await waitFor(() => {
      expect(screen.getByText('Informe o nome do planejamento.')).toBeTruthy();
      expect(mockCreatePlanejamento).not.toHaveBeenCalled();
    });
  });
});
