import {
  canAddPlanejamentoParticipant,
  canCreatePlanejamentoExpense,
  canEditPlanejamentoExpense,
  findActiveLinkedParticipant,
  isPlanejamentoOwner,
} from '../authorization/planejamentoAuthorization';
import type {
  ParticipantePlanejamento,
  Planejamento,
  PlanejamentoStatus,
} from '../types/planejamento';

const OWNER_ID = 'usuario-owner';
const LINKED_USER_ID = 'usuario-linked';

function makeParticipante(
  overrides: Partial<ParticipantePlanejamento> = {},
): ParticipantePlanejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    email: 'participante@example.com',
    id: 'participante-linked',
    nome: 'Participante',
    planejamentoId: 'planejamento-1',
    status: 'ATIVO',
    tipo: 'VINCULADO',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioId: LINKED_USER_ID,
    ...overrides,
  };
}

function makePlanejamento(
  overrides: Partial<Planejamento> = {},
): Planejamento {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    dataFim: null,
    dataInicio: null,
    deletedAt: null,
    descricao: null,
    id: 'planejamento-1',
    nome: 'Viagem',
    participantes: [],
    status: 'ABERTO',
    tipo: 'VIAGEM',
    updatedAt: '2026-01-01T00:00:00.000Z',
    usuarioCriadorId: OWNER_ID,
    ...overrides,
  };
}

describe('planejamentoAuthorization', () => {
  describe('identificacao do ator', () => {
    it('identifica o proprietario pelo usuarioCriadorId', () => {
      const planejamento = makePlanejamento();

      expect(isPlanejamentoOwner(planejamento, OWNER_ID)).toBe(true);
      expect(isPlanejamentoOwner(planejamento, LINKED_USER_ID)).toBe(false);
      expect(isPlanejamentoOwner(planejamento, null)).toBe(false);
      expect(isPlanejamentoOwner(planejamento, undefined)).toBe(false);
      expect(isPlanejamentoOwner(null, OWNER_ID)).toBe(false);
    });

    it('retorna o participante vinculado ativo do usuario autenticado', () => {
      const participante = makeParticipante();
      const planejamento = makePlanejamento({
        participantes: [participante],
      });

      expect(
        findActiveLinkedParticipant(planejamento, LINKED_USER_ID),
      ).toBe(participante);
    });

    it.each([
      ['removido', makeParticipante({ status: 'REMOVIDO' })],
      ['pendente', makeParticipante({ status: 'PENDENTE' })],
      ['manual', makeParticipante({ tipo: 'MANUAL' })],
      ['convidado', makeParticipante({ tipo: 'CONVIDADO' })],
      [
        'de outro usuario',
        makeParticipante({ usuarioId: 'usuario-diferente' }),
      ],
    ])('nao identifica participante %s como vinculado ativo', (_, item) => {
      const planejamento = makePlanejamento({ participantes: [item] });

      expect(
        findActiveLinkedParticipant(planejamento, LINKED_USER_ID),
      ).toBeNull();
    });
  });

  describe('adicao de participante', () => {
    it('permite somente proprietario em planejamento aberto', () => {
      const planejamento = makePlanejamento();

      expect(
        canAddPlanejamentoParticipant(planejamento, OWNER_ID),
      ).toBe(true);
      expect(
        canAddPlanejamentoParticipant(planejamento, LINKED_USER_ID),
      ).toBe(false);
    });

    it.each<PlanejamentoStatus>(['FECHADO', 'ARQUIVADO', 'CANCELADO'])(
      'bloqueia proprietario em planejamento %s',
      (status) => {
        expect(
          canAddPlanejamentoParticipant(
            makePlanejamento({ status }),
            OWNER_ID,
          ),
        ).toBe(false);
      },
    );
  });

  describe('criacao de gasto', () => {
    it('permite proprietario e vinculado ativo em planejamento aberto', () => {
      const planejamento = makePlanejamento({
        participantes: [makeParticipante()],
      });

      expect(
        canCreatePlanejamentoExpense(planejamento, OWNER_ID),
      ).toBe(true);
      expect(
        canCreatePlanejamentoExpense(planejamento, LINKED_USER_ID),
      ).toBe(true);
    });

    it.each([
      ['nao vinculado', []],
      ['removido', [makeParticipante({ status: 'REMOVIDO' })]],
      ['pendente', [makeParticipante({ status: 'PENDENTE' })]],
      ['manual', [makeParticipante({ tipo: 'MANUAL' })]],
    ])('bloqueia usuario %s', (_, participantes) => {
      expect(
        canCreatePlanejamentoExpense(
          makePlanejamento({ participantes }),
          LINKED_USER_ID,
        ),
      ).toBe(false);
    });

    it.each<PlanejamentoStatus>(['FECHADO', 'ARQUIVADO', 'CANCELADO'])(
      'bloqueia todos os atores em planejamento %s',
      (status) => {
        const planejamento = makePlanejamento({
          participantes: [makeParticipante()],
          status,
        });

        expect(
          canCreatePlanejamentoExpense(planejamento, OWNER_ID),
        ).toBe(false);
        expect(
          canCreatePlanejamentoExpense(planejamento, LINKED_USER_ID),
        ).toBe(false);
      },
    );
  });

  describe('edicao de gasto', () => {
    it('permite somente proprietario com planejamento aberto e gasto ativo', () => {
      const planejamento = makePlanejamento({
        participantes: [makeParticipante()],
      });

      expect(
        canEditPlanejamentoExpense(
          planejamento,
          { status: 'ATIVO' },
          OWNER_ID,
        ),
      ).toBe(true);
      expect(
        canEditPlanejamentoExpense(
          planejamento,
          { status: 'ATIVO' },
          LINKED_USER_ID,
        ),
      ).toBe(false);
    });

    it('bloqueia quando planejamento, gasto ou identidade nao estao disponiveis', () => {
      expect(
        canEditPlanejamentoExpense(
          null,
          { status: 'ATIVO' },
          OWNER_ID,
        ),
      ).toBe(false);
      expect(
        canEditPlanejamentoExpense(makePlanejamento(), null, OWNER_ID),
      ).toBe(false);
      expect(
        canEditPlanejamentoExpense(
          makePlanejamento(),
          { status: 'ATIVO' },
          null,
        ),
      ).toBe(false);
    });

    it.each<PlanejamentoStatus>(['FECHADO', 'ARQUIVADO', 'CANCELADO'])(
      'bloqueia proprietario em planejamento %s',
      (status) => {
        expect(
          canEditPlanejamentoExpense(
            makePlanejamento({ status }),
            { status: 'ATIVO' },
            OWNER_ID,
          ),
        ).toBe(false);
      },
    );

    it.each(['CANCELADO', 'PENDENTE_REVISAO'] as const)(
      'bloqueia gasto %s',
      (status) => {
        expect(
          canEditPlanejamentoExpense(
            makePlanejamento(),
            { status },
            OWNER_ID,
          ),
        ).toBe(false);
      },
    );
  });
});
