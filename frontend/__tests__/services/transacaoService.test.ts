import { api } from '../../services/api';
import {
  createTransacao,
  getTransacaoById,
  listTransacoes,
  removeTransacao,
  updateTransacao,
} from '../../services/transacaoService';
import {
  CreateTransacaoRequestDto,
  FindTransacoesParams,
  Transacao,
  UpdateTransacaoRequestDto,
} from '../../types/transacao';
import { makeTransacao, TEST_DATE } from '../../src/shared/test/builders';

// Mock the API module
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('transacaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTransacoes', () => {
    it('should return list of transacoes without params', async () => {
      const mockTransacoes: Transacao[] = [
        makeTransacao({
          id: '1',
          descricao: 'Compra mercado',
          valor: -50,
          categoriaId: 'cat1',
          contaId: 'conta1',
        }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockTransacoes,
      });

      const result = await listTransacoes();

      expect(mockedApi.get).toHaveBeenCalledWith('/transacoes', { params: undefined });
      expect(result).toEqual(mockTransacoes);
    });

    it('should return list of transacoes with params', async () => {
      const params: FindTransacoesParams = {
        contaId: 'conta1',
        mes: '2023-01',
      };

      const mockTransacoes: Transacao[] = [];

      mockedApi.get.mockResolvedValueOnce({
        data: mockTransacoes,
      });

      const result = await listTransacoes(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/transacoes', { params });
      expect(result).toEqual(mockTransacoes);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listTransacoes()).rejects.toThrow('API Error');
    });
  });

  describe('getTransacaoById', () => {
    it('should return transacao by id', async () => {
      const mockTransacao: Transacao = makeTransacao({
        id: '1',
        descricao: 'Compra mercado',
        valor: -50,
        categoriaId: 'cat1',
        contaId: 'conta1',
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockTransacao,
      });

      const result = await getTransacaoById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/transacoes/1');
      expect(result).toEqual(mockTransacao);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getTransacaoById('1')).rejects.toThrow('API Error');
    });
  });

  describe('createTransacao', () => {
    it('should create and return new transacao', async () => {
      const createData: CreateTransacaoRequestDto = {
        descricao: 'Nova transacao',
        valor: 100,
        data: TEST_DATE,
        categoriaId: 'cat1',
        contaId: 'conta1',
        tipo: 'receita',
      };

      const mockTransacao: Transacao = makeTransacao({
        id: '2',
        ...createData,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockTransacao,
      });

      const result = await createTransacao(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/transacoes', createData);
      expect(result).toEqual(mockTransacao);
    });

    it('should throw error when API fails', async () => {
      const createData: CreateTransacaoRequestDto = {
        descricao: 'Nova transacao',
        valor: 100,
        data: TEST_DATE,
        categoriaId: 'cat1',
        contaId: 'conta1',
        tipo: 'receita',
      };

      const error = new Error('API Error');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(createTransacao(createData)).rejects.toThrow('API Error');
    });
  });

  describe('updateTransacao', () => {
    it('should update and return transacao', async () => {
      const updateData: UpdateTransacaoRequestDto = {
        descricao: 'Transacao atualizada',
        valor: 150,
      };

      const mockTransacao: Transacao = makeTransacao({
        id: '1',
        descricao: 'Transacao atualizada',
        valor: 150,
        categoriaId: 'cat1',
        contaId: 'conta1',
      });

      mockedApi.patch.mockResolvedValueOnce({
        data: mockTransacao,
      });

      const result = await updateTransacao('1', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/transacoes/1', updateData);
      expect(result).toEqual(mockTransacao);
    });

    it('should throw error when API fails', async () => {
      const updateData: UpdateTransacaoRequestDto = {
        descricao: 'Transacao atualizada',
      };

      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(updateTransacao('1', updateData)).rejects.toThrow('API Error');
    });
  });

  describe('removeTransacao', () => {
    it('should remove transacao successfully', async () => {
      mockedApi.delete.mockResolvedValueOnce({});

      await expect(removeTransacao('1')).resolves.toBeUndefined();

      expect(mockedApi.delete).toHaveBeenCalledWith('/transacoes/1');
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.delete.mockRejectedValueOnce(error);

      await expect(removeTransacao('1')).rejects.toThrow('API Error');
    });
  });
});
