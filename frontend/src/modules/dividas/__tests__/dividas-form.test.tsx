import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DividasFormScreen } from '../screens/DividasFormScreen';
import * as contaService from '../../contas/services/contaService';
import * as dividaService from '../services/dividaService';
import { makeConta, makeDivida } from '../../../shared/test/builders';

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
jest.mock('../services/dividaService');

const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockCreateDivida = dividaService.createDivida as jest.MockedFunction<typeof dividaService.createDivida>;
const mockGetDividaById = dividaService.getDividaById as jest.MockedFunction<typeof dividaService.getDividaById>;
const mockUpdateDivida = dividaService.updateDivida as jest.MockedFunction<typeof dividaService.updateDivida>;

const conta = makeConta({ id: 'conta1', nome: 'Conta Corrente' });

describe('DividasFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockListContas.mockResolvedValue([conta]);
  });

  it('creates a debt with account, dates and periodicity', async () => {
    mockCreateDivida.mockResolvedValue(makeDivida());

    render(<DividasFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova divida')).toBeTruthy();
    });

    const emptyInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(emptyInputs[0], 'Emprestimo banco');
    fireEvent.changeText(screen.getByPlaceholderText('Ex.: 15000,00'), '5000');
    fireEvent.changeText(screen.getAllByPlaceholderText('YYYY-MM-DD')[0], '2026-05-01');
    fireEvent.changeText(screen.getAllByPlaceholderText('YYYY-MM-DD')[1], '2026-12-01');
    fireEvent.press(screen.getByText('Salvar divida'));

    await waitFor(() => {
      expect(mockCreateDivida).toHaveBeenCalledWith({
        contaId: 'conta1',
        cuotaMensual: undefined,
        fechaInicio: '2026-05-01',
        fechaVencimiento: '2026-12-01',
        montoTotal: 5000,
        nome: 'Emprestimo banco',
        periodicidade: 'mensal',
        proximoVencimiento: undefined,
        tasaInteres: undefined,
      });
      expect(mockReplace).toHaveBeenCalledWith('/dividas');
    });
  });

  it('validates dates before saving debt', async () => {
    render(<DividasFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nova divida')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Salvar divida'));

    await waitFor(() => {
      expect(screen.getByText('Revise os campos destacados antes de salvar.')).toBeTruthy();
      expect(screen.getByText('Informe um nome para a divida.')).toBeTruthy();
      expect(screen.getByText('Informe um valor total valido maior que zero.')).toBeTruthy();
      expect(mockCreateDivida).not.toHaveBeenCalled();
    });
  });

  it('loads debt data and updates an existing debt', async () => {
    mockLocalSearchParams = { id: 'divida1' };
    mockGetDividaById.mockResolvedValue(
      makeDivida({
        contaId: 'conta1',
        fechaInicio: '2026-05-01',
        fechaVencimiento: '2026-12-01',
        id: 'divida1',
        montoTotal: 5000,
        nome: 'Emprestimo banco',
      }),
    );
    mockUpdateDivida.mockResolvedValue(makeDivida());

    render(<DividasFormScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Emprestimo banco')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByDisplayValue('Emprestimo banco'), 'Emprestimo atualizado');
    fireEvent.press(screen.getByText('Salvar divida'));

    await waitFor(() => {
      expect(mockUpdateDivida).toHaveBeenCalledWith('divida1', {
        cuotaMensual: 500,
        fechaVencimiento: '2026-12-01',
        nome: 'Emprestimo atualizado',
        periodicidade: 'mensal',
        proximoVencimiento: '2026-06-01',
        tasaInteres: undefined,
      });
      expect(mockReplace).toHaveBeenCalledWith('/dividas');
    });
  });
});
