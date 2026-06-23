import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ContasCreateScreen } from '../screens/ContasCreateScreen';
import { ContasEditScreen } from '../screens/ContasEditScreen';
import * as contaService from '../services/contaService';
import { makeConta } from '../../../shared/test/builders';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { back: mockBack, push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../services/contaService');

const mockCreateConta = contaService.createConta as jest.MockedFunction<typeof contaService.createConta>;
const mockGetContaById = contaService.getContaById as jest.MockedFunction<typeof contaService.getContaById>;
const mockUpdateConta = contaService.updateConta as jest.MockedFunction<typeof contaService.updateConta>;

describe('Contas form screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
  });

  it('creates a bank account with name and initial balance', async () => {
    mockCreateConta.mockResolvedValue(makeConta());

    render(<ContasCreateScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Ex.: Carteira'), 'Conta Corrente');
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '1000,50');
    fireEvent.press(screen.getByText('Banco'));
    fireEvent.press(screen.getByText('Salvar conta'));

    await waitFor(() => {
      expect(mockCreateConta).toHaveBeenCalledWith({
        nome: 'Conta Corrente',
        saldoInicial: 1000.5,
        tipo: 'banco',
      });
      expect(mockReplace).toHaveBeenCalledWith('/contas');
    });
  });

  it('validates required account name before creating', async () => {
    render(<ContasCreateScreen />);

    fireEvent.press(screen.getByText('Salvar conta'));

    await waitFor(() => {
      expect(screen.getByText('Informe o nome da conta.')).toBeTruthy();
      expect(mockCreateConta).not.toHaveBeenCalled();
    });
  });

  it('creates a credit card account with operational fields', async () => {
    mockCreateConta.mockResolvedValue(makeConta({ tipo: 'cartao_credito' }));

    render(<ContasCreateScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Ex.: Carteira'), 'Cartao Principal');
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '0');
    fireEvent.press(screen.getByText('Cartao credito'));
    fireEvent.changeText(screen.getAllByPlaceholderText('1-31')[0], '10');
    fireEvent.changeText(screen.getAllByPlaceholderText('1-31')[1], '20');
    fireEvent.changeText(screen.getAllByPlaceholderText('0,00')[1], '3000');
    fireEvent.press(screen.getByText('Salvar conta'));

    await waitFor(() => {
      expect(mockCreateConta).toHaveBeenCalledWith({
        dataCorte: 10,
        dataPagamento: 20,
        limiteCredito: 3000,
        nome: 'Cartao Principal',
        saldoInicial: 0,
        tipo: 'cartao_credito',
      });
    });
  });

  it('loads and updates an existing account', async () => {
    mockLocalSearchParams = { id: 'conta1' };
    mockGetContaById.mockResolvedValue(makeConta({ id: 'conta1', nome: 'Conta Antiga' }));
    mockUpdateConta.mockResolvedValue(makeConta({ id: 'conta1', nome: 'Conta Nova' }));

    render(<ContasEditScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Conta Antiga')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByDisplayValue('Conta Antiga'), 'Conta Nova');
    fireEvent.press(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(mockUpdateConta).toHaveBeenCalledWith('conta1', {
        nome: 'Conta Nova',
      });
      expect(mockReplace).toHaveBeenCalledWith('/contas');
    });
  });
});
