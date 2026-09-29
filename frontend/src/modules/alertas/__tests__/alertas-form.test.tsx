import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { listDividas } from '../../dividas/services/dividaService';
import { listMetas } from '../../metas/services/metaService';
import { listOrcamentos } from '../../orcamentos/services/orcamentoService';
import { AlertasFormScreen } from '../screens/AlertasFormScreen';
import * as alertaService from '../services/alertaService';
import { Alerta } from '../types/alerta';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../../dividas/services/dividaService');
jest.mock('../../metas/services/metaService');
jest.mock('../../orcamentos/services/orcamentoService');
jest.mock('../services/alertaService');

const mockListDividas = listDividas as jest.MockedFunction<typeof listDividas>;
const mockListMetas = listMetas as jest.MockedFunction<typeof listMetas>;
const mockListOrcamentos = listOrcamentos as jest.MockedFunction<typeof listOrcamentos>;
const mockCreateAlerta = alertaService.createAlerta as jest.MockedFunction<typeof alertaService.createAlerta>;
const mockGetAlertaById = alertaService.getAlertaById as jest.MockedFunction<typeof alertaService.getAlertaById>;
const mockUpdateAlerta = alertaService.updateAlerta as jest.MockedFunction<typeof alertaService.updateAlerta>;

function makeAlerta(overrides: Partial<Alerta> = {}): Alerta {
  return {
    ativa: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    diasAnticipacion: 3,
    id: 'alerta-1',
    referenciaId: 'meta-1',
    tipo: 'vencimento_meta',
    ultimaNotificacion: null,
    usuarioId: 'user-1',
    ...overrides,
  };
}

describe('AlertasFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockListMetas.mockResolvedValue([
      {
        ativa: true,
        contaId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        dividaId: null,
        fechaLimite: '2026-12-31',
        id: 'meta-1',
        montoActual: 0,
        montoObjetivo: 1000,
        nome: 'Meta futura',
        tipo: 'economia',
        usuarioId: 'user-1',
      },
    ]);
    mockListDividas.mockResolvedValue([
      {
        ativa: true,
        contaId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        cuotaMensual: null,
        fechaInicio: '2026-01-01',
        fechaVencimiento: '2026-12-31',
        id: 'divida-1',
        montoTotal: 500,
        nome: 'Divida ativa',
        periodicidade: null,
        proximoVencimiento: null,
        tasaInteres: null,
        usuarioId: 'user-1',
      },
    ]);
    mockListOrcamentos.mockResolvedValue([
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        gastoAtual: 0,
        id: 'orcamento-1',
        mesReferencia: '2026-12',
        percentualUtilizado: 0,
        restante: 1000,
        statusAlerta: 'normal',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: 'user-1',
        valorPlanejado: 1000,
      },
    ]);
  });

  it('creates an alert for a compatible selected reference', async () => {
    mockCreateAlerta.mockResolvedValue(makeAlerta());

    render(<AlertasFormScreen />);

    await waitFor(() => expect(screen.getByText('Novo alerta')).toBeTruthy());
    fireEvent.press(screen.getByText('Meta futura'));
    fireEvent.press(screen.getByText('Salvar alerta'));

    await waitFor(() => {
      expect(mockCreateAlerta).toHaveBeenCalledWith({
        diasAnticipacion: 3,
        referenciaId: 'meta-1',
        tipo: 'vencimento_meta',
      });
      expect(mockReplace).toHaveBeenCalledWith('/alertas');
    });
  });

  it('clears the reference when type changes and blocks submitting without a compatible replacement', async () => {
    mockCreateAlerta.mockResolvedValue(makeAlerta({ referenciaId: 'divida-1', tipo: 'vencimento_divida' }));

    render(<AlertasFormScreen />);

    await waitFor(() => expect(screen.getByText('Meta futura')).toBeTruthy());
    fireEvent.press(screen.getByText('Meta futura'));
    fireEvent.press(screen.getByText('Divida'));
    fireEvent.press(screen.getByText('Salvar alerta'));

    await waitFor(() => {
      expect(screen.getByText('Informe uma referencia e dias de antecipacao validos.')).toBeTruthy();
      expect(mockCreateAlerta).not.toHaveBeenCalled();
    });

    fireEvent.press(screen.getByText('Divida ativa'));
    fireEvent.press(screen.getByText('Salvar alerta'));
    await waitFor(() => {
      expect(mockCreateAlerta).toHaveBeenCalledWith({
        diasAnticipacion: 3,
        referenciaId: 'divida-1',
        tipo: 'vencimento_divida',
      });
    });
  });

  it('updates only mutable alert fields and shows read-only historic references', async () => {
    mockLocalSearchParams = { id: 'alerta-1' };
    mockGetAlertaById.mockResolvedValue(makeAlerta({ referenciaId: 'historic-meta' }));
    mockUpdateAlerta.mockResolvedValue(makeAlerta({ referenciaId: 'historic-meta', diasAnticipacion: 5 }));

    render(<AlertasFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue(/Refer/)).toBeTruthy());
    expect(screen.getByDisplayValue(/Refer/).props.editable).toBe(false);
    expect(screen.getByDisplayValue('Meta').props.editable).toBe(false);

    fireEvent.changeText(screen.getByDisplayValue('3'), '5');
    fireEvent.press(screen.getByText('Salvar alerta'));

    await waitFor(() => {
      expect(mockUpdateAlerta).toHaveBeenCalledWith('alerta-1', { diasAnticipacion: 5 });
      expect(mockReplace).toHaveBeenCalledWith('/alertas');
    });
  });

  it('shows backend validation errors without navigating away', async () => {
    mockLocalSearchParams = { id: 'alerta-1' };
    mockGetAlertaById.mockResolvedValue(makeAlerta());
    mockUpdateAlerta.mockRejectedValue({
      response: { data: { error: { message: 'Referencia invalida.' } }, status: 422 },
    });

    render(<AlertasFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Meta futura')).toBeTruthy());
    fireEvent.press(screen.getByText('Salvar alerta'));

    await waitFor(() => {
      expect(screen.getByText('Referencia invalida.')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
