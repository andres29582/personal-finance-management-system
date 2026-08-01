import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as authStorage from '../../../../storage/authStorage';
import { PlanejamentoParticipanteFormScreen } from '../screens/PlanejamentoParticipanteFormScreen';
import * as planejamentoService from '../services/planejamentoService';
import type {
  ParticipantePlanejamento,
  Planejamento,
  PlanejamentoStatus,
} from '../types/planejamento';

const OWNER_ID = 'usuario-owner';
const LINKED_USER_ID = 'usuario-linked';
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockLocalSearchParams: Record<string, string> = { id: 'planejamento-1' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock('../../../../storage/authStorage');
jest.mock('../services/planejamentoService');

const mockAddParticipantePlanejamento = jest.mocked(
  planejamentoService.addParticipantePlanejamento,
);
const mockClearSession = jest.mocked(authStorage.clearSession);
const mockGetPlanejamentoById = jest.mocked(
  planejamentoService.getPlanejamentoById,
);
const mockGetUser = jest.mocked(authStorage.getUser);

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  let reject: Deferred<T>['reject'] = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function makeParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email: 'ana@example.com',
    id: 'participante-1',
    nome: 'Ana',
    planejamentoId: 'planejamento-1',
    status: 'ATIVO',
    tipo: 'VINCULADO',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: OWNER_ID,
    ...overrides,
  };
}

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: null,
    dataInicio: '2026-01-10',
    deletedAt: null,
    descricao: 'Custos compartilhados',
    id: 'planejamento-1',
    nome: 'Viagem',
    participantes: [makeParticipante()],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: OWNER_ID,
    ...overrides,
  };
}

function makeUser(id = OWNER_ID) {
  return {
    email: `${id}@example.com`,
    id,
    nome: id,
  };
}

async function renderAuthorized() {
  const rendered = render(<PlanejamentoParticipanteFormScreen />);

  await waitFor(() => {
    expect(screen.getByText('Salvar participante')).toBeTruthy();
  });

  return rendered;
}

function fillParticipantForm() {
  fireEvent.changeText(
    screen.getByPlaceholderText('Nome do participante'),
    'Ana',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('email@exemplo.com'),
    'ana@example.com',
  );
}

describe('PlanejamentoParticipanteFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = { id: 'planejamento-1' };
    mockClearSession.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    mockGetPlanejamentoById.mockResolvedValue(makePlanejamento());
    mockAddParticipantePlanejamento.mockResolvedValue(makeParticipante());
  });

  it('permite ao proprietario adicionar participante em planejamento aberto', async () => {
    await renderAuthorized();
    fillParticipantForm();

    fireEvent.press(screen.getByText('Salvar participante'));

    await waitFor(() => {
      expect(mockAddParticipantePlanejamento).toHaveBeenCalledWith(
        'planejamento-1',
        { email: 'ana@example.com', nome: 'Ana' },
      );
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('preserva a validacao obrigatoria de nome', async () => {
    await renderAuthorized();

    fireEvent.press(screen.getByText('Salvar participante'));

    expect(screen.getByText('Informe o nome do participante.')).toBeTruthy();
    expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
  });

  it('preserva a validacao de email quando informado', async () => {
    await renderAuthorized();
    fireEvent.changeText(
      screen.getByPlaceholderText('Nome do participante'),
      'Ana',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('email@exemplo.com'),
      'email-invalido',
    );

    fireEvent.press(screen.getByText('Salvar participante'));

    expect(screen.getByText('Informe um email valido.')).toBeTruthy();
    expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: 'vinculado ativo',
      participante: makeParticipante({
        id: 'participante-linked',
        usuarioId: LINKED_USER_ID,
      }),
    },
    {
      description: 'vinculado removido',
      participante: makeParticipante({
        id: 'participante-linked',
        status: 'REMOVIDO',
        usuarioId: LINKED_USER_ID,
      }),
    },
    {
      description: 'vinculado pendente',
      participante: makeParticipante({
        id: 'participante-linked',
        status: 'PENDENTE',
        usuarioId: LINKED_USER_ID,
      }),
    },
    {
      description: 'participante manual',
      participante: makeParticipante({
        id: 'participante-manual',
        tipo: 'MANUAL',
        usuarioId: LINKED_USER_ID,
      }),
    },
    {
      description: 'usuario nao vinculado',
      participante: null,
    },
  ])('bloqueia $description', async ({ participante }) => {
    mockGetUser.mockResolvedValue(makeUser(LINKED_USER_ID));
    mockGetPlanejamentoById.mockResolvedValue(
      makePlanejamento({
        participantes: participante
          ? [makeParticipante(), participante]
          : [makeParticipante()],
      }),
    );

    render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('Apenas o proprietario pode adicionar participantes.'),
      ).toBeTruthy();
    });

    expect(screen.queryByPlaceholderText('Nome do participante')).toBeNull();
    expect(screen.queryByText('Salvar participante')).toBeNull();
    expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
  });

  it.each<PlanejamentoStatus>(['FECHADO', 'ARQUIVADO', 'CANCELADO'])(
    'bloqueia o proprietario em planejamento %s',
    async (status) => {
      mockGetPlanejamentoById.mockResolvedValue(
        makePlanejamento({ status }),
      );

      render(<PlanejamentoParticipanteFormScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Apenas planejamentos abertos permitem adicionar participantes.',
          ),
        ).toBeTruthy();
      });

      expect(screen.queryByText('Salvar participante')).toBeNull();
      expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
    },
  );

  it('mantem o formulario indisponivel durante a carga da autorizacao', async () => {
    const userDeferred = createDeferred<Awaited<ReturnType<typeof authStorage.getUser>>>();
    const planejamentoDeferred = createDeferred<Planejamento>();
    mockGetUser.mockReturnValue(userDeferred.promise);
    mockGetPlanejamentoById.mockReturnValue(planejamentoDeferred.promise);

    render(<PlanejamentoParticipanteFormScreen />);

    expect(screen.getByText('Carregando autorizacao...')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Nome do participante')).toBeNull();
    expect(screen.queryByText('Salvar participante')).toBeNull();

    await act(async () => {
      userDeferred.resolve(makeUser());
      planejamentoDeferred.resolve(makePlanejamento());
    });

    await waitFor(() => {
      expect(screen.getByText('Salvar participante')).toBeTruthy();
    });
  });

  it('impede duplo envio no mesmo contexto', async () => {
    const saveDeferred = createDeferred<ParticipantePlanejamento>();
    mockAddParticipantePlanejamento.mockReturnValue(saveDeferred.promise);
    await renderAuthorized();
    fillParticipantForm();
    const saveButton = screen.getByText('Salvar participante');

    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(mockAddParticipantePlanejamento).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Salvando...')).toBeTruthy();

    await act(async () => {
      saveDeferred.resolve(makeParticipante());
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/planejamentos-detail',
        params: { id: 'planejamento-1' },
      });
    });
  });

  it('invalida a resposta anterior ao trocar planejamento', async () => {
    const planejamentoADeferred = createDeferred<Planejamento>();
    mockGetPlanejamentoById
      .mockReturnValueOnce(planejamentoADeferred.promise)
      .mockResolvedValueOnce(makePlanejamento({ id: 'planejamento-b' }));
    const rendered = render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledWith('planejamento-1');
    });

    mockLocalSearchParams = { id: 'planejamento-b' };
    rendered.rerender(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Salvar participante')).toBeTruthy();
    });

    await act(async () => {
      planejamentoADeferred.resolve(
        makePlanejamento({ id: 'planejamento-1', status: 'FECHADO' }),
      );
    });

    expect(screen.getByText('Salvar participante')).toBeTruthy();
    expect(
      screen.queryByText(
        'Apenas planejamentos abertos permitem adicionar participantes.',
      ),
    ).toBeNull();
  });

  it('protege a sequencia A para B para A por geracao', async () => {
    const planejamentoAOld = createDeferred<Planejamento>();
    const planejamentoB = createDeferred<Planejamento>();
    const planejamentoANew = createDeferred<Planejamento>();
    mockGetPlanejamentoById
      .mockReturnValueOnce(planejamentoAOld.promise)
      .mockReturnValueOnce(planejamentoB.promise)
      .mockReturnValueOnce(planejamentoANew.promise);
    const rendered = render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(1);
    });

    mockLocalSearchParams = { id: 'planejamento-b' };
    rendered.rerender(<PlanejamentoParticipanteFormScreen />);
    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(2);
    });

    mockLocalSearchParams = { id: 'planejamento-1' };
    rendered.rerender(<PlanejamentoParticipanteFormScreen />);
    await waitFor(() => {
      expect(mockGetPlanejamentoById).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      planejamentoANew.resolve(makePlanejamento());
    });
    await waitFor(() => {
      expect(screen.getByText('Salvar participante')).toBeTruthy();
    });

    await act(async () => {
      planejamentoB.resolve(
        makePlanejamento({ id: 'planejamento-b', status: 'FECHADO' }),
      );
      planejamentoAOld.resolve(
        makePlanejamento({ id: 'planejamento-1', status: 'CANCELADO' }),
      );
    });

    expect(screen.getByText('Salvar participante')).toBeTruthy();
  });

  it('ignora resposta de carga depois do unmount', async () => {
    const planejamentoDeferred = createDeferred<Planejamento>();
    mockGetPlanejamentoById.mockReturnValue(planejamentoDeferred.promise);
    const rendered = render(<PlanejamentoParticipanteFormScreen />);

    rendered.unmount();

    await act(async () => {
      planejamentoDeferred.resolve(makePlanejamento());
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redireciona ao login para unauthorized da carga atual', async () => {
    mockGetPlanejamentoById.mockRejectedValue({
      response: { status: 401 },
    });

    render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
      expect(
        screen.getByText('Sessao expirada. Faca login novamente.'),
      ).toBeTruthy();
    });
  });

  it('trata identidade ausente como sessao expirada no contexto atual', async () => {
    mockGetUser.mockResolvedValue(null);

    render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sessao expirada')).toBeTruthy();
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    expect(screen.queryByPlaceholderText('Nome do participante')).toBeNull();
    expect(screen.queryByText('Salvar participante')).toBeNull();
    expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
  });

  it('nao redireciona por unauthorized obsoleto', async () => {
    const planejamentoADeferred = createDeferred<Planejamento>();
    mockGetPlanejamentoById
      .mockReturnValueOnce(planejamentoADeferred.promise)
      .mockResolvedValueOnce(makePlanejamento({ id: 'planejamento-b' }));
    const rendered = render(<PlanejamentoParticipanteFormScreen />);

    mockLocalSearchParams = { id: 'planejamento-b' };
    rendered.rerender(<PlanejamentoParticipanteFormScreen />);
    await waitFor(() => {
      expect(screen.getByText('Salvar participante')).toBeTruthy();
    });

    await act(async () => {
      planejamentoADeferred.reject({ response: { status: 401 } });
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/login');
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(screen.getByText('Salvar participante')).toBeTruthy();
  });

  it('nao navega quando o sucesso pertence a rota antiga', async () => {
    const saveDeferred = createDeferred<ParticipantePlanejamento>();
    mockAddParticipantePlanejamento.mockReturnValue(saveDeferred.promise);
    const rendered = await renderAuthorized();
    fillParticipantForm();
    fireEvent.press(screen.getByText('Salvar participante'));

    mockLocalSearchParams = { id: 'planejamento-b' };
    mockGetPlanejamentoById.mockResolvedValueOnce(
      makePlanejamento({ id: 'planejamento-b' }),
    );
    rendered.rerender(<PlanejamentoParticipanteFormScreen />);
    await waitFor(() => {
      expect(screen.getByText('Salvar participante')).toBeTruthy();
    });

    await act(async () => {
      saveDeferred.resolve(makeParticipante());
    });

    expect(mockReplace).not.toHaveBeenCalledWith({
      pathname: '/planejamentos-detail',
      params: { id: 'planejamento-1' },
    });
  });

  it('mostra planejamento inexistente ou inacessivel sem expor formulario', async () => {
    mockGetPlanejamentoById.mockRejectedValue({
      response: {
        data: { message: 'Planejamento nao encontrado.' },
        status: 404,
      },
    });

    render(<PlanejamentoParticipanteFormScreen />);

    await waitFor(() => {
      expect(screen.getByText('Planejamento nao encontrado.')).toBeTruthy();
    });
    expect(screen.queryByText('Salvar participante')).toBeNull();
    expect(mockAddParticipantePlanejamento).not.toHaveBeenCalled();
  });

  it('mantem a acao de voltar quando o id nao foi informado', async () => {
    mockLocalSearchParams = {};

    render(<PlanejamentoParticipanteFormScreen />);

    expect(screen.getByText('Planejamento nao informado.')).toBeTruthy();
    fireEvent.press(screen.getByText('Voltar'));

    expect(mockPush).toHaveBeenCalledWith('/planejamentos');
    expect(mockGetPlanejamentoById).not.toHaveBeenCalled();
  });
});
