import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PrevisaoDeficitScreen } from '../screens/PrevisaoDeficitScreen';
import * as previsaoService from '../services/previsaoService';
import * as authStorage from '../../../../storage/authStorage';
import { PrevisaoDeficitResponse } from '../types/previsao';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../services/previsaoService');
jest.mock('../../../../storage/authStorage');

const mockGetPrevisaoDeficit = previsaoService.getPrevisaoDeficit as jest.MockedFunction<typeof previsaoService.getPrevisaoDeficit>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;

const previsao: PrevisaoDeficitResponse = {
  schemaVersion: 2,
  deficitPrevisto: true,
  indicadores: {
    historicoMeses: 3,
    saldoInicialMes: 1000,
    mediaReceitas3Meses: 3000,
    mediaDespesas3Meses: 4500,
    tendenciaReceitas3Meses: 100,
    tendenciaDespesas3Meses: 250,
    taxaDeficit3Meses: 0.6667,
  },
  mensagem: 'Risco alto de deficit para o mes.',
  mesReferencia: '2026-06',
  prediction: 1,
  probability: 0.82,
  risco: 'alto',
};

describe('PrevisaoDeficitScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSession.mockResolvedValue(undefined);
    mockGetPrevisaoDeficit.mockResolvedValue(previsao);
  });

  it('renders prediction result, probability and model features', async () => {
    render(<PrevisaoDeficitScreen />);

    await waitFor(() => {
      expect(screen.getByText('Previsao de deficit')).toBeTruthy();
      expect(screen.getByText('Risco alto de deficit para o mes.')).toBeTruthy();
      expect(screen.getByText('Alto')).toBeTruthy();
      expect(screen.getByText('82%')).toBeTruthy();
      expect(screen.getByText('Deficit')).toBeTruthy();
      expect(screen.getByText('Periodo: 2026-06')).toBeTruthy();
      expect(screen.getByText('R$ 3.000,00')).toBeTruthy();
      expect(screen.getByText('R$ 4.500,00')).toBeTruthy();
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });
  });

  it('generates prediction for a manually selected month', async () => {
    render(<PrevisaoDeficitScreen />);

    await waitFor(() => {
      expect(mockGetPrevisaoDeficit).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(screen.getByPlaceholderText('2026-05'), '2026-07');
    fireEvent.press(screen.getByText('Gerar previsao'));

    await waitFor(() => {
      expect(mockGetPrevisaoDeficit).toHaveBeenLastCalledWith('2026-07');
    });
  });

  it('redirects to login when prediction returns unauthorized', async () => {
    mockGetPrevisaoDeficit.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    render(<PrevisaoDeficitScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });

  it('clears the previous prediction when history is insufficient', async () => {
    render(<PrevisaoDeficitScreen />);

    await waitFor(() => {
      expect(screen.getByText('Risco alto de deficit para o mes.')).toBeTruthy();
    });

    mockGetPrevisaoDeficit.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: {
            code: 'PREVISAO_INSUFFICIENT_HISTORY',
            message:
              'Sao necessarios tres meses completos de historico para gerar a previsao.',
            details: { requiredMonths: 3, availableMonths: 1 },
          },
        },
      },
    });
    fireEvent.press(screen.getByText('Gerar previsao'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Sao necessarios tres meses completos de historico para gerar a previsao.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText('Risco alto de deficit para o mes.'),
      ).toBeNull();
    });
  });
});
