import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as orcamentoService from '../services/orcamentoService';
import { Orcamento } from '../types/orcamento';
import { OrcamentoFormScreen } from '../screens/OrcamentoFormScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/orcamentoService');

const mockCreateOrcamento = orcamentoService.createOrcamento as jest.MockedFunction<
  typeof orcamentoService.createOrcamento
>;
const mockGetOrcamentoById = orcamentoService.getOrcamentoById as jest.MockedFunction<
  typeof orcamentoService.getOrcamentoById
>;
const mockUpdateOrcamento = orcamentoService.updateOrcamento as jest.MockedFunction<
  typeof orcamentoService.updateOrcamento
>;

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

describe('OrcamentoFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
  });

  it('creates a budget and exposes the canonical profile action', async () => {
    mockCreateOrcamento.mockResolvedValue(makeOrcamento());

    render(<OrcamentoFormScreen />);

    fireEvent.press(screen.getByLabelText('Abrir perfil do usuário'));
    expect(mockPush).toHaveBeenCalledWith('/usuario');

    fireEvent.changeText(screen.getByPlaceholderText('2026-04'), '2026-10');
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '1200,50');
    fireEvent.press(screen.getByText('Salvar orcamento'));

    await waitFor(() => {
      expect(mockCreateOrcamento).toHaveBeenCalledWith({
        mesReferencia: '2026-10',
        valorPlanejado: 1200.5,
      });
      expect(mockReplace).toHaveBeenCalledWith('/orcamentos');
    });
  });

  it('updates only the mutable budget value', async () => {
    mockLocalSearchParams = { id: 'orcamento-1' };
    mockGetOrcamentoById.mockResolvedValue(makeOrcamento());
    mockUpdateOrcamento.mockResolvedValue(makeOrcamento({ valorPlanejado: 1500 }));

    render(<OrcamentoFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('2026-04')).toBeTruthy());
    expect(screen.getByDisplayValue('2026-04').props.editable).toBe(false);

    fireEvent.changeText(screen.getByDisplayValue('1000'), '1500');
    fireEvent.press(screen.getByText('Salvar orcamento'));

    await waitFor(() => {
      expect(mockUpdateOrcamento).toHaveBeenCalledWith('orcamento-1', {
        valorPlanejado: 1500,
      });
      expect(mockReplace).toHaveBeenCalledWith('/orcamentos');
    });
  });
});
