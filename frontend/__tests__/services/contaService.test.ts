import { api } from '../../services/api';
import {
  createConta,
  deactivateConta,
  getContaById,
  listContas,
  updateConta,
} from '../../services/contaService';
import { Conta, CreateContaRequestDto, UpdateContaRequestDto } from '../../types/conta';
import { makeConta } from '../../src/shared/test/builders';

// Mock the API module
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('contaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listContas', () => {
    it('should return list of contas', async () => {
      const mockContas: Conta[] = [
        makeConta({ id: '1' }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockContas,
      });

      const result = await listContas();

      expect(mockedApi.get).toHaveBeenCalledWith('/contas');
      expect(result).toEqual(mockContas);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listContas()).rejects.toThrow('API Error');
    });
  });

  describe('getContaById', () => {
    it('should return conta by id', async () => {
      const mockConta: Conta = makeConta({ id: '1' });

      mockedApi.get.mockResolvedValueOnce({
        data: mockConta,
      });

      const result = await getContaById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/contas/1');
      expect(result).toEqual(mockConta);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(getContaById('1')).rejects.toThrow('API Error');
    });
  });

  describe('createConta', () => {
    it('should create and return new conta', async () => {
      const createData: CreateContaRequestDto = {
        nome: 'Nova Conta',
        saldoInicial: 500,
        tipo: 'poupanca',
      };

      const mockConta: Conta = makeConta({
        id: '2',
        ...createData,
        saldoAtual: 500,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockConta,
      });

      const result = await createConta(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/contas', createData);
      expect(result).toEqual(mockConta);
    });

    it('should throw error when API fails', async () => {
      const createData: CreateContaRequestDto = {
        nome: 'Nova Conta',
        saldoInicial: 500,
        tipo: 'poupanca',
      };

      const error = new Error('API Error');
      mockedApi.post.mockRejectedValueOnce(error);

      await expect(createConta(createData)).rejects.toThrow('API Error');
    });
  });

  describe('updateConta', () => {
    it('should update and return conta', async () => {
      const updateData: UpdateContaRequestDto = {
        nome: 'Conta Atualizada',
      };

      const mockConta: Conta = makeConta({
        nome: 'Conta Atualizada',
        saldoAtual: 1500,
      });

      mockedApi.patch.mockResolvedValueOnce({
        data: mockConta,
      });

      const result = await updateConta('1', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/contas/1', updateData);
      expect(result).toEqual(mockConta);
    });

    it('should throw error when API fails', async () => {
      const updateData: UpdateContaRequestDto = {
        nome: 'Conta Atualizada',
      };

      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(updateConta('1', updateData)).rejects.toThrow('API Error');
    });
  });

  describe('deactivateConta', () => {
    it('should deactivate conta successfully', async () => {
      mockedApi.patch.mockResolvedValueOnce({});

      await expect(deactivateConta('1')).resolves.toBeUndefined();

      expect(mockedApi.patch).toHaveBeenCalledWith('/contas/1/desativar');
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.patch.mockRejectedValueOnce(error);

      await expect(deactivateConta('1')).rejects.toThrow('API Error');
    });
  });
});
