import { api } from '../../../shared/services/api';
import {
  createPagoDivida,
  getPagoDividaById,
  listPagosByDivida,
  removePagoDivida,
} from '../services/pagoDividaService';
import { makePagoDivida, TEST_DATE } from '../../../shared/test/builders';
import { CreatePagoDividaRequestDto, PagoDivida } from '../types/pago-divida';

// Mock the API module
jest.mock('../../../shared/services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('pagoDividaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listPagosByDivida', () => {
    it('should return list of pagos by divida id', async () => {
      const mockPagos: PagoDivida[] = [
        makePagoDivida({
          id: '1',
          valor: 500,
          dividaId: 'divida1',
        }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockPagos,
      });

      const result = await listPagosByDivida('divida1');

      expect(mockedApi.get).toHaveBeenCalledWith('/pagos-divida/divida/divida1');
      expect(result).toEqual(mockPagos);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listPagosByDivida('divida1')).rejects.toThrow('API Error');
    });
  });

  describe('getPagoDividaById', () => {
    it('should return pago divida by id', async () => {
      const mockPago: PagoDivida = makePagoDivida({
        id: '1',
        valor: 500,
        dividaId: 'divida1',
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockPago,
      });

      const result = await getPagoDividaById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/pagos-divida/1');
      expect(result).toEqual(mockPago);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getPagoDividaById('1')).rejects.toThrow('API Error');
    });
  });

  describe('createPagoDivida', () => {
    it('should create and return new pago divida', async () => {
      const createData: CreatePagoDividaRequestDto = {
        categoriaId: 'cat1',
        contaId: 'conta1',
        data: TEST_DATE,
        dividaId: 'divida1',
        valor: 300,
      };

      const mockPago: PagoDivida = makePagoDivida({
        id: '2',
        ...createData,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockPago,
      });

      const result = await createPagoDivida(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/pagos-divida', createData);
      expect(result).toEqual(mockPago);
    });

    it('should throw error when API fails', async () => {
      const createData: CreatePagoDividaRequestDto = {
        categoriaId: 'cat1',
        contaId: 'conta1',
        data: TEST_DATE,
        dividaId: 'divida1',
        valor: 300,
      };

      const error = new Error('API Error');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(createPagoDivida(createData)).rejects.toThrow('API Error');
    });
  });

  describe('removePagoDivida', () => {
    it('should remove pago divida successfully', async () => {
      mockedApi.delete.mockResolvedValueOnce({});

      await expect(removePagoDivida('1')).resolves.toBeUndefined();

      expect(mockedApi.delete).toHaveBeenCalledWith('/pagos-divida/1');
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.delete.mockRejectedValueOnce(error);

      await expect(removePagoDivida('1')).rejects.toThrow('API Error');
    });
  });
});
