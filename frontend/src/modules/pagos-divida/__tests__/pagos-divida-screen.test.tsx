import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PagosDividaScreen } from '../screens/PagosDividaScreen';
import * as categoriaService from '../../categorias/services/categoriaService';
import * as contaService from '../../contas/services/contaService';
import * as dividaService from '../../dividas/services/dividaService';
import * as pagoDividaService from '../services/pagoDividaService';
import * as authStorage from '../../../../storage/authStorage';
import { confirmAction } from '../../../../utils/confirm-action';
import {
  makeCategoria,
  makeConta,
  makeDivida,
  makePagoDivida,
} from '../../../shared/test/builders';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { dividaId: 'divida1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../../categorias/services/categoriaService');
jest.mock('../../contas/services/contaService');
jest.mock('../../dividas/services/dividaService');
jest.mock('../services/pagoDividaService');
jest.mock('../../../../storage/authStorage');
jest.mock('../../../../utils/confirm-action');

const mockListCategorias = categoriaService.listCategorias as jest.MockedFunction<typeof categoriaService.listCategorias>;
const mockListContas = contaService.listContas as jest.MockedFunction<typeof contaService.listContas>;
const mockGetDividaById = dividaService.getDividaById as jest.MockedFunction<typeof dividaService.getDividaById>;
const mockListPagosByDivida = pagoDividaService.listPagosByDivida as jest.MockedFunction<typeof pagoDividaService.listPagosByDivida>;
const mockCreatePagoDivida = pagoDividaService.createPagoDivida as jest.MockedFunction<typeof pagoDividaService.createPagoDivida>;
const mockRemovePagoDivida = pagoDividaService.removePagoDivida as jest.MockedFunction<typeof pagoDividaService.removePagoDivida>;
const mockClearSession = authStorage.clearSession as jest.MockedFunction<typeof authStorage.clearSession>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const conta = makeConta({ id: 'conta1', nome: 'Conta Corrente' });
const categoria = makeCategoria({ id: 'cat1', nome: 'Dividas', tipo: 'despesa' });
const pago = makePagoDivida({
  contaId: 'conta1',
  data: '2026-05-01',
  descricao: 'Parcela maio',
  dividaId: 'divida1',
  id: 'pago1',
  valor: 500,
});

function mockSuccessfulLoad() {
  mockGetDividaById.mockResolvedValue(makeDivida({ id: 'divida1' }));
  mockListPagosByDivida.mockResolvedValue([pago]);
  mockListContas.mockResolvedValue([conta]);
  mockListCategorias.mockResolvedValue([categoria]);
}

describe('PagosDividaScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { dividaId: 'divida1' };
    mockClearSession.mockResolvedValue(undefined);
    mockConfirmAction.mockResolvedValue(true);
  });

  it('renders payment form and existing payment history', async () => {
    mockSuccessfulLoad();

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(mockGetDividaById).toHaveBeenCalledWith('divida1');
      expect(mockListPagosByDivida).toHaveBeenCalledWith('divida1');
      expect(mockListCategorias).toHaveBeenCalledWith('despesa');
      expect(screen.getByText('Pagamentos da divida')).toBeTruthy();
      expect(screen.getByText('Conta Corrente')).toBeTruthy();
      expect(screen.getByText('Dividas')).toBeTruthy();
      expect(screen.getByText('Parcela maio')).toBeTruthy();
      expect(screen.getByText('01/05/2026')).toBeTruthy();
      expect(screen.getByText('R$ 500,00')).toBeTruthy();
    });
  });

  it('registers a debt payment and reloads payment history', async () => {
    mockSuccessfulLoad();
    mockCreatePagoDivida.mockResolvedValue(makePagoDivida());

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Registrar pagamento')).toBeTruthy();
    });

    const emptyInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(emptyInputs[0], '300,75');
    fireEvent.changeText(emptyInputs[1], 'Parcela extra');
    fireEvent.press(screen.getByText('Registrar pagamento'));

    await waitFor(() => {
      expect(mockCreatePagoDivida).toHaveBeenCalledWith({
        categoriaId: 'cat1',
        contaId: 'conta1',
        data: expect.any(String),
        descricao: 'Parcela extra',
        dividaId: 'divida1',
        valor: 300.75,
      });
      expect(mockListPagosByDivida).toHaveBeenCalledTimes(2);
    });
  });

  it('blocks save when payment value is invalid', async () => {
    mockSuccessfulLoad();

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Registrar pagamento')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Registrar pagamento'));

    await waitFor(() => {
      expect(screen.getByText('Preencha conta, categoria, valor e data.')).toBeTruthy();
      expect(mockCreatePagoDivida).not.toHaveBeenCalled();
    });
  });

  it('blocks save when payment date is invalid', async () => {
    mockSuccessfulLoad();

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Registrar pagamento')).toBeTruthy();
    });

    const emptyInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(emptyInputs[0], '300,75');
    fireEvent.changeText(
      screen.getByDisplayValue(new Date().toISOString().slice(0, 10)),
      '01/05/2026',
    );
    fireEvent.press(screen.getByText('Registrar pagamento'));

    await waitFor(() => {
      expect(screen.getByText('Informe uma data valida no formato YYYY-MM-DD.')).toBeTruthy();
      expect(mockCreatePagoDivida).not.toHaveBeenCalled();
    });
  });

  it('blocks payment form when debt is inactive', async () => {
    mockGetDividaById.mockResolvedValue(makeDivida({ ativa: false, id: 'divida1' }));
    mockListPagosByDivida.mockResolvedValue([]);
    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Divida inativa')).toBeTruthy();
      expect(
        screen.getByText('Nao e possivel registrar pagamento para uma divida inativa.'),
      ).toBeTruthy();
    });

    expect(screen.queryByText('Registrar pagamento')).toBeNull();
    expect(mockCreatePagoDivida).not.toHaveBeenCalled();
  });

  it('shows a clear message when backend rejects payment for inactive debt', async () => {
    mockSuccessfulLoad();
    mockCreatePagoDivida.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'PAGAMENTO_DIVIDA_INACTIVE_DEBT',
            message: 'Backend inactive debt message',
          },
        },
        status: 400,
      },
    });

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Registrar pagamento')).toBeTruthy();
    });

    const emptyInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(emptyInputs[0], '300,75');
    fireEvent.changeText(emptyInputs[1], 'Parcela extra');
    fireEvent.press(screen.getByText('Registrar pagamento'));

    await waitFor(() => {
      expect(mockCreatePagoDivida).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Nao e possivel registrar pagamento para uma divida inativa.'),
      ).toBeTruthy();
    });
  });

  it('removes payment after confirmation and reloads history', async () => {
    mockSuccessfulLoad();
    mockRemovePagoDivida.mockResolvedValue(undefined);

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(screen.getByText('Excluir')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Excluir'));

    await waitFor(() => {
      expect(mockConfirmAction).toHaveBeenCalledWith(
        'Excluir pagamento',
        'Deseja remover este pagamento?',
      );
      expect(mockRemovePagoDivida).toHaveBeenCalledWith('pago1');
      expect(mockListPagosByDivida).toHaveBeenCalledTimes(2);
    });
  });

  it('redirects to login when loading fails with unauthorized error', async () => {
    mockGetDividaById.mockResolvedValue(makeDivida({ id: 'divida1' }));
    mockListPagosByDivida.mockRejectedValue({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });
    mockListContas.mockResolvedValue([conta]);
    mockListCategorias.mockResolvedValue([categoria]);

    render(<PagosDividaScreen />);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(screen.getByText('Sessao expirada. Faca login novamente.')).toBeTruthy();
    });
  });
});
