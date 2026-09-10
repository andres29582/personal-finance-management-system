import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { getContaById, listContas } from '../../contas/services/contaService';
import { getDividaById, listDividas } from '../../dividas/services/dividaService';
import { MetasFormScreen } from '../screens/MetasFormScreen';
import * as metaService from '../services/metaService';
import { Meta } from '../types/meta';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../../contas/services/contaService');
jest.mock('../../dividas/services/dividaService');
jest.mock('../services/metaService');

const mockListContas = listContas as jest.MockedFunction<typeof listContas>;
const mockListDividas = listDividas as jest.MockedFunction<typeof listDividas>;
const mockGetContaById = getContaById as jest.MockedFunction<typeof getContaById>;
const mockGetDividaById = getDividaById as jest.MockedFunction<typeof getDividaById>;
const mockCreateMeta = metaService.createMeta as jest.MockedFunction<typeof metaService.createMeta>;
const mockGetMetaById = metaService.getMetaById as jest.MockedFunction<typeof metaService.getMetaById>;
const mockUpdateMeta = metaService.updateMeta as jest.MockedFunction<typeof metaService.updateMeta>;

function makeMeta(overrides: Partial<Meta> = {}): Meta {
  return {
    ativa: true,
    contaId: 'conta-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    dividaId: 'divida-1',
    fechaLimite: '2026-12-31',
    id: 'meta-1',
    montoActual: 0,
    montoObjetivo: 1000,
    nome: 'Reserva',
    tipo: 'economia',
    usuarioId: 'user-1',
    ...overrides,
  };
}

describe('MetasFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockListContas.mockResolvedValue([
      {
        ativa: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        dataCorte: null,
        dataPagamento: null,
        id: 'conta-1',
        limiteCredito: null,
        moeda: 'BRL',
        nome: 'Conta principal',
        saldoAtual: 0,
        saldoInicial: 0,
        tipo: 'banco',
        updatedAt: '2026-01-01T00:00:00.000Z',
        usuarioId: 'user-1',
      },
    ]);
    mockListDividas.mockResolvedValue([
      {
        ativa: true,
        contaId: 'conta-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        cuotaMensual: null,
        fechaInicio: '2026-01-01',
        fechaVencimiento: '2026-12-31',
        id: 'divida-1',
        montoTotal: 500,
        nome: 'Emprestimo',
        periodicidade: null,
        proximoVencimiento: null,
        tasaInteres: null,
        usuarioId: 'user-1',
      },
    ]);
  });

  it('creates a goal with its create-only associations', async () => {
    mockCreateMeta.mockResolvedValue(makeMeta());

    render(<MetasFormScreen />);

    await waitFor(() => expect(screen.getByText('Nova meta')).toBeTruthy());
    const inputs = screen.UNSAFE_getAllByType(TextInput);
    fireEvent.changeText(inputs[0], 'Reserva');
    fireEvent.changeText(inputs[1], '1000');
    fireEvent.changeText(screen.getByPlaceholderText('2026-12-31'), '2026-12-31');
    fireEvent.press(screen.getByText('Salvar meta'));

    await waitFor(() => {
      expect(mockCreateMeta).toHaveBeenCalledWith({
        contaId: undefined,
        dividaId: undefined,
        fechaLimite: '2026-12-31',
        montoObjetivo: 1000,
        nome: 'Reserva',
        tipo: 'economia',
      });
      expect(mockReplace).toHaveBeenCalledWith('/metas');
    });
  });

  it('updates a goal with zero current amount and keeps structural fields read-only', async () => {
    mockLocalSearchParams = { id: 'meta-1' };
    mockGetMetaById.mockResolvedValue(makeMeta());
    mockUpdateMeta.mockResolvedValue(makeMeta());

    render(<MetasFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Reserva')).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue('Reserva'), 'Reserva atualizada');
    fireEvent.press(screen.getByText('Salvar meta'));

    await waitFor(() => {
      expect(mockUpdateMeta).toHaveBeenCalledWith('meta-1', {
        fechaLimite: '2026-12-31',
        montoActual: 0,
        montoObjetivo: 1000,
        nome: 'Reserva atualizada',
      });
      expect(mockReplace).toHaveBeenCalledWith('/metas');
    });

    expect(screen.getByDisplayValue('Economia').props.editable).toBe(false);
    expect(screen.getByDisplayValue('Conta principal').props.editable).toBe(false);
    expect(screen.getByDisplayValue('Emprestimo').props.editable).toBe(false);
  });

  it('shows inactive linked associations while editing', async () => {
    mockLocalSearchParams = { id: 'meta-1' };
    mockListContas.mockResolvedValue([]);
    mockListDividas.mockResolvedValue([]);
    mockGetMetaById.mockResolvedValue(makeMeta());
    mockGetContaById.mockResolvedValue({
      ativa: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      dataCorte: null,
      dataPagamento: null,
      id: 'conta-1',
      limiteCredito: null,
      moeda: 'BRL',
      nome: 'Conta desativada',
      saldoAtual: 0,
      saldoInicial: 0,
      tipo: 'banco',
      updatedAt: '2026-01-01T00:00:00.000Z',
      usuarioId: 'user-1',
    });
    mockGetDividaById.mockResolvedValue({
      ativa: false,
      contaId: 'conta-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      cuotaMensual: null,
      fechaInicio: '2026-01-01',
      fechaVencimiento: '2026-12-31',
      id: 'divida-1',
      montoTotal: 500,
      nome: 'Divida desativada',
      periodicidade: null,
      proximoVencimiento: null,
      tasaInteres: null,
      usuarioId: 'user-1',
    });

    render(<MetasFormScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Conta desativada').props.editable).toBe(false);
      expect(screen.getByDisplayValue('Divida desativada').props.editable).toBe(false);
    });
  });

  it('blocks invalid due dates and negative current amounts', async () => {
    mockLocalSearchParams = { id: 'meta-1' };
    mockGetMetaById.mockResolvedValue(makeMeta());

    render(<MetasFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Reserva')).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue('2026-12-31'), '2026-02-30');
    fireEvent.press(screen.getByText('Salvar meta'));
    await waitFor(() => {
      expect(screen.getByText('Preencha nome, objetivo e data limite.')).toBeTruthy();
      expect(mockUpdateMeta).not.toHaveBeenCalled();
    });

    fireEvent.changeText(screen.getByDisplayValue('2026-02-30'), '2026-12-31');
    fireEvent.changeText(screen.getByDisplayValue('0'), '-1');
    fireEvent.press(screen.getByText('Salvar meta'));
    await waitFor(() => {
      expect(screen.getByText('O valor atual deve ser maior ou igual a zero.')).toBeTruthy();
      expect(mockUpdateMeta).not.toHaveBeenCalled();
    });
  });

  it('shows backend errors without navigating away', async () => {
    mockLocalSearchParams = { id: 'meta-1' };
    mockGetMetaById.mockResolvedValue(makeMeta());
    mockUpdateMeta.mockRejectedValue({
      response: { data: { error: { message: 'Data limite invalida.' } }, status: 400 },
    });

    render(<MetasFormScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Reserva')).toBeTruthy());
    fireEvent.press(screen.getByText('Salvar meta'));

    await waitFor(() => {
      expect(screen.getByText('Data limite invalida.')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
