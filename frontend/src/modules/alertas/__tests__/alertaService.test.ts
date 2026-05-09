import {
  createAlerta,
  deactivateAlerta,
  getAlertaById,
  listAlertas,
  markAlertaAsNotified,
  updateAlerta,
} from '../services/alertaService';
import { Alerta, CreateAlertaRequestDto } from '../types/alerta';
import { api } from '../../../shared/services/api';

jest.mock('../../../shared/services/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function makeAlerta(overrides: Partial<Alerta> = {}): Alerta {
  return {
    ativa: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    diasAnticipacion: 3,
    id: 'alerta-1',
    referenciaId: 'meta-1',
    tipo: 'vencimento_meta',
    ultimaNotificacion: null,
    usuarioId: 'usuario-1',
    ...overrides,
  };
}

describe('alertaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista alertas', async () => {
    const alertas = [makeAlerta()];
    mockedApi.get.mockResolvedValueOnce({ data: alertas });

    const result = await listAlertas();

    expect(mockedApi.get).toHaveBeenCalledWith('/alertas');
    expect(result).toEqual(alertas);
  });

  it('busca alerta por id', async () => {
    const alerta = makeAlerta({ id: 'alerta-2' });
    mockedApi.get.mockResolvedValueOnce({ data: alerta });

    const result = await getAlertaById('alerta-2');

    expect(mockedApi.get).toHaveBeenCalledWith('/alertas/alerta-2');
    expect(result).toEqual(alerta);
  });

  it('cria alerta', async () => {
    const payload: CreateAlertaRequestDto = {
      diasAnticipacion: 5,
      referenciaId: 'divida-1',
      tipo: 'vencimento_divida',
    };
    const alerta = makeAlerta(payload);
    mockedApi.post.mockResolvedValueOnce({ data: alerta });

    const result = await createAlerta(payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/alertas', payload);
    expect(result).toEqual(alerta);
  });

  it('atualiza alerta', async () => {
    const payload = { diasAnticipacion: 7 };
    const alerta = makeAlerta(payload);
    mockedApi.patch.mockResolvedValueOnce({ data: alerta });

    const result = await updateAlerta('alerta-1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/alertas/alerta-1', payload);
    expect(result).toEqual(alerta);
  });

  it('desativa alerta', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: undefined });

    await deactivateAlerta('alerta-1');

    expect(mockedApi.patch).toHaveBeenCalledWith('/alertas/alerta-1/desativar');
  });

  it('marca alerta como notificado', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: undefined });

    await markAlertaAsNotified('alerta-1');

    expect(mockedApi.patch).toHaveBeenCalledWith('/alertas/alerta-1/notificar');
  });
});
