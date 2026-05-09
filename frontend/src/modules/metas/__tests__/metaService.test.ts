import { api } from '../../../shared/services/api';
import {
  createMeta,
  deactivateMeta,
  getMetaById,
  listMetas,
  updateMeta,
} from '../services/metaService';
import { CreateMetaRequestDto, Meta, UpdateMetaRequestDto } from '../types/meta';

jest.mock('../../../shared/services/api');
const mockedApi = api as jest.Mocked<typeof api>;

const makeMeta = (overrides: Partial<Meta> = {}): Meta => ({
  ativa: true,
  contaId: 'conta1',
  createdAt: '2026-05-01T12:00:00.000Z',
  dividaId: null,
  fechaLimite: '2026-12-31',
  id: 'meta1',
  montoActual: 100,
  montoObjetivo: 1000,
  nome: 'Reserva',
  tipo: 'economia',
  usuarioId: 'user1',
  ...overrides,
});

describe('metaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list metas', async () => {
    const metas = [makeMeta()];
    mockedApi.get.mockResolvedValueOnce({ data: metas });

    const result = await listMetas();

    expect(mockedApi.get).toHaveBeenCalledWith('/metas');
    expect(result).toEqual(metas);
  });

  it('should get meta by id', async () => {
    const meta = makeMeta({ id: '1' });
    mockedApi.get.mockResolvedValueOnce({ data: meta });

    const result = await getMetaById('1');

    expect(mockedApi.get).toHaveBeenCalledWith('/metas/1');
    expect(result).toEqual(meta);
  });

  it('should create meta', async () => {
    const data: CreateMetaRequestDto = {
      fechaLimite: '2026-12-31',
      montoObjetivo: 1000,
      nome: 'Reserva',
      tipo: 'economia',
    };
    const meta = makeMeta(data);
    mockedApi.post.mockResolvedValueOnce({ data: meta });

    const result = await createMeta(data);

    expect(mockedApi.post).toHaveBeenCalledWith('/metas', data);
    expect(result).toEqual(meta);
  });

  it('should update meta', async () => {
    const data: UpdateMetaRequestDto = { montoActual: 250 };
    const meta = makeMeta(data);
    mockedApi.patch.mockResolvedValueOnce({ data: meta });

    const result = await updateMeta('1', data);

    expect(mockedApi.patch).toHaveBeenCalledWith('/metas/1', data);
    expect(result).toEqual(meta);
  });

  it('should deactivate meta', async () => {
    mockedApi.patch.mockResolvedValueOnce({});

    await expect(deactivateMeta('1')).resolves.toBeUndefined();

    expect(mockedApi.patch).toHaveBeenCalledWith('/metas/1/desativar');
  });
});
