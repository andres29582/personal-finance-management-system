import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TransferenciaFormScreen } from '../screens/TransferenciaFormScreen';
import * as contaService from '../../contas/services/contaService';
import * as transferenciaService from '../services/transferenciaService';
import { makeConta, makeTransferencia } from '../../../shared/test/builders';

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
jest.mock('../services/transferenciaService');

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockCreateTransferencia = transferenciaService.createTransferencia as jest.MockedFunction<typeof transferenciaService.createTransferencia>;
const mockGetTransferenciaById = transferenciaService.getTransferenciaById as jest.MockedFunction<typeof transferenciaService.getTransferenciaById>;
const mockUpdateTransferencia = transferenciaService.updateTransferencia as jest.MockedFunction<typeof transferenciaService.updateTransferencia>;

const contaOrigem = makeConta({ id: 'conta1', nome: 'Conta Corrente' });
const contaDestino = makeConta({ id: 'conta2', nome: 'Poupanca' });

function mockContas() {
  mockListContas.mockResolvedValue([contaOrigem, contaDestino]);
}

describe('TransferenciaFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
  });

  it('creates a transfer with distinct accounts and default commission', async () => {
    mockContas();
    mockCreateTransferencia.mockResolvedValue(makeTransferencia());

    render(<TransferenciaFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova transferencia')).toBeTruthy();
    });

    const emptyInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(emptyInputs[0], '200,50');
    fireEvent.changeText(emptyInputs[2], 'Reserva mensal');
    fireEvent.press(screen.getByText('Salvar transferencia'));

    await waitFor(() => {
      expect(mockCreateTransferencia).toHaveBeenCalledWith({
        comissao: 0,
        contaDestinoId: 'conta2',
        contaOrigemId: 'conta1',
        data: expect.any(String),
        descricao: 'Reserva mensal',
        valor: 200.5,
      });
      expect(mockReplace).toHaveBeenCalledWith('/transferencias');
    });
  });

  it('blocks save when source and destination accounts are the same', async () => {
    mockListContas.mockResolvedValue([contaOrigem]);

    render(<TransferenciaFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova transferencia')).toBeTruthy();
    });

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '100');
    fireEvent.press(screen.getByText('Salvar transferencia'));

    await waitFor(() => {
      expect(screen.getByText('Conta origem e destino devem ser diferentes.')).toBeTruthy();
      expect(mockCreateTransferencia).not.toHaveBeenCalled();
    });
  });

  it('blocks save when transfer date is invalid', async () => {
    mockContas();

    render(<TransferenciaFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova transferencia')).toBeTruthy();
    });

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '100');
    fireEvent.changeText(
      screen.getByDisplayValue(new Date().toISOString().slice(0, 10)),
      '2026-99-99',
    );
    fireEvent.press(screen.getByText('Salvar transferencia'));

    await waitFor(() => {
      expect(screen.getByText('Informe uma data valida no formato YYYY-MM-DD.')).toBeTruthy();
      expect(mockCreateTransferencia).not.toHaveBeenCalled();
    });
  });

  it('loads transfer data and updates an existing transfer', async () => {
    mockContas();
    mockLocalSearchParams = { id: 'transferencia1' };
    mockGetTransferenciaById.mockResolvedValue(
      makeTransferencia({
        comissao: 2,
        contaDestinoId: 'conta2',
        contaOrigemId: 'conta1',
        data: '2026-05-01',
        descricao: 'Reserva mensal',
        id: 'transferencia1',
        valor: 200,
      }),
    );
    mockUpdateTransferencia.mockResolvedValue(makeTransferencia());

    render(<TransferenciaFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Editar transferencia')).toBeTruthy();
      expect(screen.getByDisplayValue('Reserva mensal')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByDisplayValue('200'), '250');
    fireEvent.press(screen.getByText('Salvar transferencia'));

    await waitFor(() => {
      expect(mockUpdateTransferencia).toHaveBeenCalledWith('transferencia1', {
        comissao: 2,
        contaDestinoId: 'conta2',
        contaOrigemId: 'conta1',
        data: '2026-05-01',
        descricao: 'Reserva mensal',
        valor: 250,
      });
      expect(mockReplace).toHaveBeenCalledWith('/transferencias');
    });
  });

  it('shows backend error when save fails', async () => {
    mockContas();
    mockCreateTransferencia.mockRejectedValue({
      response: { status: 400, data: { message: 'Saldo insuficiente.' } },
    });

    render(<TransferenciaFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova transferencia')).toBeTruthy();
    });

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '100');
    fireEvent.press(screen.getByText('Salvar transferencia'));

    await waitFor(() => {
      expect(screen.getByText('Saldo insuficiente.')).toBeTruthy();
    });
  });
});
