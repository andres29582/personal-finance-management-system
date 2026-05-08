import { api } from '../../../shared/services/api';
import { makeCategoria } from '../../../shared/test/builders';
import {
  createCategoria,
  deactivateCategoria,
  getCategoriaById,
  listCategorias,
  updateCategoria,
} from '../services/categoriaService';
import {
  Categoria,
  CreateCategoriaRequestDto,
  UpdateCategoriaRequestDto,
} from '../types/categoria';

jest.mock('../../../shared/services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('categoriaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategorias', () => {
    it('should return list of categorias without tipo param', async () => {
      const mockCategorias: Categoria[] = [makeCategoria({ id: '1' })];

      mockedApi.get.mockResolvedValueOnce({
        data: mockCategorias,
      });

      const result = await listCategorias();

      expect(mockedApi.get).toHaveBeenCalledWith('/categorias', {
        params: undefined,
      });
      expect(result).toEqual(mockCategorias);
    });

    it('should return list of categorias with tipo param', async () => {
      const mockCategorias: Categoria[] = [
        makeCategoria({ id: '1', tipo: 'despesa' }),
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: mockCategorias,
      });

      const result = await listCategorias('despesa');

      expect(mockedApi.get).toHaveBeenCalledWith('/categorias', {
        params: { tipo: 'despesa' },
      });
      expect(result).toEqual(mockCategorias);
    });

    it('should throw error when API fails', async () => {
      const error = new Error('API Error');
      mockedApi.get.mockRejectedValueOnce(error);

      await expect(listCategorias()).rejects.toThrow('API Error');
    });
  });

  describe('getCategoriaById', () => {
    it('should return categoria by id', async () => {
      const mockCategoria: Categoria = makeCategoria({ id: '1' });

      mockedApi.get.mockResolvedValueOnce({
        data: mockCategoria,
      });

      const result = await getCategoriaById('1');

      expect(mockedApi.get).toHaveBeenCalledWith('/categorias/1');
      expect(result).toEqual(mockCategoria);
    });
  });

  describe('createCategoria', () => {
    it('should create and return new categoria', async () => {
      const createData: CreateCategoriaRequestDto = {
        nome: 'Transporte',
        tipo: 'despesa',
      };
      const mockCategoria: Categoria = makeCategoria({
        id: '2',
        ...createData,
      });

      mockedApi.post.mockResolvedValueOnce({
        data: mockCategoria,
      });

      const result = await createCategoria(createData);

      expect(mockedApi.post).toHaveBeenCalledWith('/categorias', createData);
      expect(result).toEqual(mockCategoria);
    });
  });

  describe('updateCategoria', () => {
    it('should update and return categoria', async () => {
      const updateData: UpdateCategoriaRequestDto = {
        nome: 'Categoria Atualizada',
      };
      const mockCategoria: Categoria = makeCategoria(updateData);

      mockedApi.patch.mockResolvedValueOnce({
        data: mockCategoria,
      });

      const result = await updateCategoria('1', updateData);

      expect(mockedApi.patch).toHaveBeenCalledWith('/categorias/1', updateData);
      expect(result).toEqual(mockCategoria);
    });
  });

  describe('deactivateCategoria', () => {
    it('should deactivate categoria successfully', async () => {
      mockedApi.patch.mockResolvedValueOnce({});

      await expect(deactivateCategoria('1')).resolves.toBeUndefined();

      expect(mockedApi.patch).toHaveBeenCalledWith('/categorias/1/desativar');
    });
  });
});
