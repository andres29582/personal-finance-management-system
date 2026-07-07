import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanejamentoParticipanteFormScreen } from '../screens/PlanejamentoParticipanteFormScreen';
import * as planejamentoService from '../services/planejamentoService';
import { ParticipantePlanejamento } from '../types/planejamento';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { id: 'planejamento-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/planejamentoService');

const mockAddParticipantePlanejamento =
  planejamentoService.addParticipantePlanejamento as jest.MockedFunction<
    typeof planejamentoService.addParticipantePlanejamento
  >;

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

describe('PlanejamentoParticipanteFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
  });

  it('bloqueia envio sem nome', async () => {
    render(<PlanejamentoParticipanteFormScreen />);

    fireEvent.press(screen.getByText('Salvar participante'));

    await waitFor(() => {
      expect(screen.getByText('Informe o nome do participante.')).toBeTruthy();
      expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
    });
  });

  it('bloqueia email invalido quando informado', async () => {
    render(<PlanejamentoParticipanteFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Nome do participante'),
      'Ana',
    );
    fireEvent.changeText(screen.getByPlaceholderText('email@exemplo.com'), 'ana');
    fireEvent.press(screen.getByText('Salvar participante'));

    await waitFor(() => {
      expect(screen.getByText('Informe um email valido.')).toBeTruthy();
      expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
    });
  });

  it('adiciona participante e volta ao detalhe', async () => {
    mockAddParticipantePlanejamento.mockResolvedValue(makeParticipante());

    render(<PlanejamentoParticipanteFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Nome do participante'),
      'Ana',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('email@exemplo.com'),
      'ana@example.com',
    );
    fireEvent.press(screen.getByText('Salvar participante'));

    await waitFor(() => {
      expect(mockAddParticipantePlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        {
          email: 'ana@example.com',
          nome: 'Ana',
        },
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('mostra erro quando adicionar participante falha', async () => {
    mockAddParticipantePlanejamento.mockRejectedValue({
      response: { status: 409, data: { message: 'Participante duplicado.' } },
    });

    render(<PlanejamentoParticipanteFormScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Nome do participante'),
      'Ana',
    );
    fireEvent.press(screen.getByText('Salvar participante'));

    await waitFor(() => {
      expect(screen.getByText('Participante duplicado.')).toBeTruthy();
    });
  });
});
