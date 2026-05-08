import { api } from '../../services/api';
import {
  createDivida,
  deactivateDivida,
  getDividaById,
  listDividas,
  updateDivida,
} from '../../services/dividaService';
import { CreateDividaRequestDto, Divida, UpdateDividaRequestDto } from '../../types/divida';
import { makeDivida, TEST_DATE } from '../../src/shared/test/builders';

// Mock the API module
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('dividaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listDividas', () => {
    it('should return list of dividas', async () => {
      const mockDividas: Divida[] = [
        makeDivida({
          id: '1',
          nome: 'Emprestimo banco',
          montoTotal: 5000,
        }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockDividas,
      });

      const result = await listDividas();

      expect(mockedApi.get).toHaveBeenCalledWith('/dividas');
      expect(result).toEqual(mockDividas);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listDividas()).rejects.toThrow('API Error');
    });
  });

  describe('getDividaById', () => {
    it('should return divida by id', async () => {
      const mockDivida: Divida = makeDivida({
        id: '1',
        nome: 'Emprestimo banco',
        montoTotal: 5000,
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockDivida,
      });

      const result = await getDividaById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/dividas/1');
      expect(result).toEqual(mockDivida);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getDividaById('1')).rejects.toThrow('API Error');
    });
  });

  describe('createDivida', () => {
    it('should create and return new divida', async () => {
      const createData: CreateDividaRequestDto = {
        fechaInicio: TEST_DATE,
        fechaVencimiento: '2026-12-01',
        montoTotal: 2000,
        nome: 'Nova divida',
      };

      const mockDivida: Divida = makeDivida({
        id: '2',
        ...createData,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockDivida,
      });

      const result = await createDivida(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/dividas', createData);
      expect(result).toEqual(mockDivida);
    });

    it('should throw error when API fails', async () => {
      const createData: CreateDividaRequestDto = {
        fechaInicio: TEST_DATE,
        fechaVencimiento: '2026-12-01',
        montoTotal: 2000,
        nome: 'Nova divida',
      };

      const error = new Error('API Error');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(createDivida(createData)).rejects.toThrow('API Error');
    });
  });

  describe('updateDivida', () => {
    it('should update and return divida', async () => {
      const updateData: UpdateDividaRequestDto = {
        cuotaMensual: 300,
        nome: 'Divida atualizada',
      };

      const mockDivida: Divida = makeDivida({
        cuotaMensual: 300,
        montoTotal: 3000,
        nome: 'Divida atualizada',
      });

      mockedApi.patch.mockResolvedValueOnce({
        data: mockDivida,
      });

      const result = await updateDivida('1', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/dividas/1', updateData);
      expect(result).toEqual(mockDivida);
    });

    it('should throw error when API fails', async () => {
      const updateData: UpdateDividaRequestDto = {
        nome: 'Divida atualizada',
      };

      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(updateDivida('1', updateData)).rejects.toThrow('API Error');
    });
  });

  describe('deactivateDivida', () => {
    it('should deactivate divida successfully', async () => {
      mockedApi.patch.mockResolvedValueOnce({});

      await expect(deactivateDivida('1')).resolves.toBeUndefined();

      expect(mockedApi.patch).toHaveBeenCalledWith('/dividas/1/desativar');
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(deactivateDivida('1')).rejects.toThrow('API Error');
    });
  });
});
