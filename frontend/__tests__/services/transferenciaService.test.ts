import { api } from '../../services/api';
import {
  createTransferencia,
  getTransferenciaById,
  listTransferencias,
  removeTransferencia,
  updateTransferencia,
} from '../../services/transferenciaService';
import {
  CreateTransferenciaRequestDto,
  Transferencia,
  UpdateTransferenciaRequestDto,
} from '../../types/transferencia';
import { makeTransferencia, TEST_DATE } from '../utils/builders';

// Mock the API module
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('transferenciaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTransferencias', () => {
    it('should return list of transferencias', async () => {
      const mockTransferencias: Transferencia[] = [
        makeTransferencia({
          id: '1',
          descricao: 'Transferencia entre contas',
          valor: 200,
          contaOrigemId: 'conta1',
          contaDestinoId: 'conta2',
        }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockTransferencias,
      });

      const result = await listTransferencias();

      expect(mockedApi.get).toHaveBeenCalledWith('/transferencias');
      expect(result).toEqual(mockTransferencias);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listTransferencias()).rejects.toThrow('API Error');
    });
  });

  describe('getTransferenciaById', () => {
    it('should return transferencia by id', async () => {
      const mockTransferencia: Transferencia = makeTransferencia({
        id: '1',
        descricao: 'Transferencia entre contas',
        valor: 200,
        contaOrigemId: 'conta1',
        contaDestinoId: 'conta2',
      });

      mockedApi.get.mockResolvedValueOnce({
        data: mockTransferencia,
      });

      const result = await getTransferenciaById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/transferencias/1');
      expect(result).toEqual(mockTransferencia);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getTransferenciaById('1')).rejects.toThrow('API Error');
    });
  });

  describe('createTransferencia', () => {
    it('should create and return new transferencia', async () => {
      const createData: CreateTransferenciaRequestDto = {
        descricao: 'Nova transferencia',
        valor: 300,
        data: TEST_DATE,
        contaOrigemId: 'conta1',
        contaDestinoId: 'conta2',
      };

      const mockTransferencia: Transferencia = makeTransferencia({
        id: '2',
        ...createData,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockTransferencia,
      });

      const result = await createTransferencia(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/transferencias', createData);
      expect(result).toEqual(mockTransferencia);
    });

    it('should throw error when API fails', async () => {
      const createData: CreateTransferenciaRequestDto = {
        descricao: 'Nova transferencia',
        valor: 300,
        data: TEST_DATE,
        contaOrigemId: 'conta1',
        contaDestinoId: 'conta2',
      };

      const error = new Error('API Error');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(createTransferencia(createData)).rejects.toThrow('API Error');
    });
  });

  describe('updateTransferencia', () => {
    it('should update and return transferencia', async () => {
      const updateData: UpdateTransferenciaRequestDto = {
        descricao: 'Transferencia atualizada',
        valor: 250,
      };

      const mockTransferencia: Transferencia = makeTransferencia({
        id: '1',
        descricao: 'Transferencia atualizada',
        valor: 250,
        contaOrigemId: 'conta1',
        contaDestinoId: 'conta2',
      });

      mockedApi.patch.mockResolvedValueOnce({
        data: mockTransferencia,
      });

      const result = await updateTransferencia('1', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/transferencias/1', updateData);
      expect(result).toEqual(mockTransferencia);
    });

    it('should throw error when API fails', async () => {
      const updateData: UpdateTransferenciaRequestDto = {
        descricao: 'Transferencia atualizada',
      };

      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(updateTransferencia('1', updateData)).rejects.toThrow('API Error');
    });
  });

  describe('removeTransferencia', () => {
    it('should remove transferencia successfully', async () => {
      mockedApi.delete.mockResolvedValueOnce({});

      await expect(removeTransferencia('1')).resolves.toBeUndefined();

      expect(mockedApi.delete).toHaveBeenCalledWith('/transferencias/1');
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.delete.mockRejectedValueOnce(error);

      await expect(removeTransferencia('1')).rejects.toThrow('API Error');
    });
  });
});
