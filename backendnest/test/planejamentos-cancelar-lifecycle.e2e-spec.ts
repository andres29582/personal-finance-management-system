import { randomUUID } from 'crypto';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import { Planejamento } from '../src/planejamentos/entities/planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
  GastoStatus,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from '../src/planejamentos/enums';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  type E2eAuthSession,
  registerAndLoginTestUser,
} from './helpers/auth.e2e-helper';
import { type Identifiable, unwrapSuccess } from './helpers/http.helper';

type ParticipanteResponse = Identifiable & {
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
  status: PlanejamentoStatus;
};

type GastoResponse = Identifiable & {
  status: GastoStatus;
};

type CenarioFinanceiro = {
  planejamento: PlanejamentoResponse;
  participanteProprietario: ParticipanteResponse;
  participanteDevedor: ParticipanteResponse;
  gasto: GastoResponse;
  acerto: AcertoPlanejamento;
};

type ResumoResponse = {
  statusOperacional: PlanejamentoStatus;
  situacaoFinanceira: 'PENDENTE' | 'QUITADO';
  obrigacaoResidualCentavos: number;
};

jest.setTimeout(60000);

describe('Planejamentos cancellation lifecycle (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let participanteVinculado: E2eAuthSession;
  let usuarioSemAcesso: E2eAuthSession;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.cancelar.owner.e2e@example.com',
      nome: 'Proprietario Cancelamento E2E',
    });
    participanteVinculado = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.cancelar.participant.e2e@example.com',
      nome: 'Participante Cancelamento E2E',
    });
    usuarioSemAcesso = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'planejamento.cancelar.outsider.e2e@example.com',
      nome: 'Usuario Sem Acesso Cancelamento E2E',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const authorization = (session = proprietario) => `Bearer ${session.token}`;

  async function buscarLogsCancelamento(
    planejamentoId: string,
  ): Promise<AuditLog[]> {
    return dataSource.getRepository(AuditLog).find({
      where: {
        entity: 'planejamento',
        entityId: planejamentoId,
        event: 'PLANEJAMENTO_CANCELADO',
      },
    });
  }

  function expectLogCancelamento(logs: AuditLog[]): void {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: 'update',
        entity: 'planejamento',
        event: 'PLANEJAMENTO_CANCELADO',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
        userId: proprietario.userId,
      }),
    );
    expect(logs[0].details).toEqual({
      statusAnterior: PlanejamentoStatus.ABERTO,
      statusPosterior: PlanejamentoStatus.CANCELADO,
    });
  }

  async function criarPlanejamento(
    sufixo: string,
  ): Promise<PlanejamentoResponse> {
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: `Cancelamento ${sufixo}`,
        tipo: PlanejamentoTipo.CASA,
      })
      .expect(201);

    return unwrapSuccess<PlanejamentoResponse>(response);
  }

  async function criarCenarioFinanceiro(
    sufixo: string,
    vincularParticipante = false,
  ): Promise<CenarioFinanceiro> {
    const planejamento = await criarPlanejamento(sufixo);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === proprietario.userId,
    );

    expect(participanteProprietario).toBeDefined();

    const participanteResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization())
      .send({
        nome: `Participante ${sufixo}`,
        ...(vincularParticipante
          ? { usuarioId: participanteVinculado.userId }
          : {}),
      })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);
    const gastoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization())
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-16',
        descricao: `Gasto ${sufixo}`,
        pagoPorParticipanteId: participanteProprietario!.id,
        participantesIds: [
          participanteProprietario!.id,
          participanteDevedor.id,
        ],
        valorCentavos: 10000,
      })
      .expect(201);
    const gasto = unwrapSuccess<GastoResponse>(gastoResponse);
    const acerto = await dataSource
      .getRepository(AcertoPlanejamento)
      .findOneByOrFail({
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      });

    return {
      planejamento,
      participanteProprietario: participanteProprietario!,
      participanteDevedor,
      gasto,
      acerto,
    };
  }

  async function quitar(cenario: CenarioFinanceiro): Promise<void> {
    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenario.planejamento.id}/acertos/${cenario.acerto.id}/pagar`,
      )
      .set('Authorization', authorization())
      .expect(200);
  }

  async function snapshotHistorico(planejamentoId: string) {
    const gastos = await dataSource.getRepository(GastoPlanejamento).find({
      where: { planejamentoId },
      order: { id: 'ASC' },
    });

    return {
      participantes: await dataSource
        .getRepository(ParticipantePlanejamento)
        .find({ where: { planejamentoId }, order: { id: 'ASC' } }),
      gastos,
      divisoes: await dataSource.getRepository(DivisaoGasto).find({
        where: gastos.map((gasto) => ({ gastoId: gasto.id })),
        order: { id: 'ASC' },
      }),
      acertos: await dataSource.getRepository(AcertoPlanejamento).find({
        where: { planejamentoId },
        order: { id: 'ASC' },
      }),
    };
  }

  function expectDomainError(
    response: Response,
    code: string,
    statusAtual?: PlanejamentoStatus,
  ): void {
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code,
          ...(statusAtual === undefined ? {} : { details: { statusAtual } }),
        }) as object,
      }),
    );
  }

  it('cancels an empty ABERTO + QUITADO planejamento', async () => {
    const planejamento = await criarPlanejamento('vazio');

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/cancelar`)
      .set('Authorization', authorization())
      .expect(200);

    expect(unwrapSuccess<PlanejamentoResponse>(response)).toEqual(
      expect.objectContaining({
        id: planejamento.id,
        status: PlanejamentoStatus.CANCELADO,
      }),
    );
    const logs = await buscarLogsCancelamento(planejamento.id);
    expect(logs[0]).toEqual(
      expect.objectContaining({ entityId: planejamento.id }),
    );
    expectLogCancelamento(logs);
  });

  it('allows PENDENTE_REVISAO without a valid obligation and preserves it as history', async () => {
    const cenario = await criarCenarioFinanceiro('revisao pendente');
    await dataSource.getRepository(GastoPlanejamento).update(cenario.gasto.id, {
      status: GastoStatus.PENDENTE_REVISAO,
    });

    await request(app.getHttpServer())
      .patch(`/planejamentos/${cenario.planejamento.id}/cancelar`)
      .set('Authorization', authorization())
      .expect(200);

    expect(
      await dataSource.getRepository(GastoPlanejamento).findOneByOrFail({
        id: cenario.gasto.id,
      }),
    ).toEqual(
      expect.objectContaining({ status: GastoStatus.PENDENTE_REVISAO }),
    );
    expect(
      await dataSource.getRepository(AcertoPlanejamento).findOneByOrFail({
        id: cenario.acerto.id,
      }),
    ).toEqual(expect.objectContaining({ status: AcertoStatus.CANCELADO }));
  });

  it('preserves settled financial history and makes the canceled aggregate completely read-only', async () => {
    const cenario = await criarCenarioFinanceiro('historico quitado');
    await quitar(cenario);
    const snapshotAntes = await snapshotHistorico(cenario.planejamento.id);

    const cancelamentoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cenario.planejamento.id}/cancelar`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<PlanejamentoResponse>(cancelamentoResponse)).toEqual(
      expect.objectContaining({ status: PlanejamentoStatus.CANCELADO }),
    );
    expect(await snapshotHistorico(cenario.planejamento.id)).toEqual(
      snapshotAntes,
    );

    await request(app.getHttpServer())
      .get('/planejamentos')
      .set('Authorization', authorization())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/planejamentos/${cenario.planejamento.id}`)
      .set('Authorization', authorization())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/planejamentos/${cenario.planejamento.id}/gastos`)
      .set('Authorization', authorization())
      .expect(200);
    await request(app.getHttpServer())
      .get(
        `/planejamentos/${cenario.planejamento.id}/gastos/${cenario.gasto.id}`,
      )
      .set('Authorization', authorization())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/planejamentos/${cenario.planejamento.id}/acertos`)
      .set('Authorization', authorization())
      .expect(200);
    const resumoResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${cenario.planejamento.id}/resumo`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<ResumoResponse>(resumoResponse)).toEqual(
      expect.objectContaining({
        statusOperacional: PlanejamentoStatus.CANCELADO,
        situacaoFinanceira: 'QUITADO',
        obrigacaoResidualCentavos: 0,
      }),
    );

    const estruturais = [
      request(app.getHttpServer())
        .post(`/planejamentos/${cenario.planejamento.id}/participantes`)
        .set('Authorization', authorization())
        .send({ nome: 'Participante bloqueado' }),
      request(app.getHttpServer())
        .delete(
          `/planejamentos/${cenario.planejamento.id}/participantes/${cenario.participanteDevedor.id}`,
        )
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .post(`/planejamentos/${cenario.planejamento.id}/gastos`)
        .set('Authorization', authorization())
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-16',
          descricao: 'Gasto bloqueado',
          pagoPorParticipanteId: cenario.participanteProprietario.id,
          participantesIds: [
            cenario.participanteProprietario.id,
            cenario.participanteDevedor.id,
          ],
          valorCentavos: 2000,
        }),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/gastos/${cenario.gasto.id}`,
        )
        .set('Authorization', authorization())
        .send({ descricao: 'Edicao bloqueada' }),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/gastos/${cenario.gasto.id}/cancelar`,
        )
        .set('Authorization', authorization()),
    ];

    for (const response of await Promise.all(estruturais)) {
      expect(response.status).toBe(422);
      expectDomainError(
        response,
        'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
        PlanejamentoStatus.CANCELADO,
      );
    }

    const acertos = [
      request(app.getHttpServer())
        .post(`/planejamentos/${cenario.planejamento.id}/acertos/sincronizar`)
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${cenario.acerto.id}/pagar`,
        )
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${cenario.acerto.id}/cancelar`,
        )
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${cenario.acerto.id}/reabrir`,
        )
        .set('Authorization', authorization()),
    ];

    for (const response of await Promise.all(acertos)) {
      expect(response.status).toBe(422);
      expectDomainError(
        response,
        'PLANEJAMENTO_ACERTO_OPERACAO_STATUS_INVALIDO',
        PlanejamentoStatus.CANCELADO,
      );
    }

    const transicoes = [
      {
        response: await request(app.getHttpServer())
          .patch(`/planejamentos/${cenario.planejamento.id}/fechar`)
          .set('Authorization', authorization()),
        code: 'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      },
      {
        response: await request(app.getHttpServer())
          .patch(`/planejamentos/${cenario.planejamento.id}/arquivar`)
          .set('Authorization', authorization()),
        code: 'PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO',
      },
      {
        response: await request(app.getHttpServer())
          .patch(`/planejamentos/${cenario.planejamento.id}/cancelar`)
          .set('Authorization', authorization()),
        code: 'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      },
    ];

    for (const { response, code } of transicoes) {
      expect(response.status).toBe(422);
      expectDomainError(response, code, PlanejamentoStatus.CANCELADO);
    }
    expect(await snapshotHistorico(cenario.planejamento.id)).toEqual(
      snapshotAntes,
    );
  });

  it('rejects pending, closed, archived, repeated, inaccessible and non-owner cancellations', async () => {
    const pendente = await criarCenarioFinanceiro('pendente invalido');
    const pendenteResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${pendente.planejamento.id}/cancelar`)
      .set('Authorization', authorization());
    expect(pendenteResponse.status).toBe(422);
    expectDomainError(
      pendenteResponse,
      'PLANEJAMENTO_CANCELAR_PENDENCIA_FINANCEIRA',
    );
    const pendenteBody = pendenteResponse.body as {
      error: { details: Record<string, unknown> };
    };
    expect(pendenteBody.error.details).toEqual({
      situacaoFinanceira: 'PENDENTE',
      obrigacaoResidualCentavos: 5000,
    });

    const fechado = await criarPlanejamento('fechado invalido');
    await request(app.getHttpServer())
      .patch(`/planejamentos/${fechado.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
    const fechadoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${fechado.id}/cancelar`)
      .set('Authorization', authorization());
    expect(fechadoResponse.status).toBe(422);
    expectDomainError(
      fechadoResponse,
      'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      PlanejamentoStatus.FECHADO,
    );

    const arquivado = await criarPlanejamento('arquivado invalido');
    await request(app.getHttpServer())
      .patch(`/planejamentos/${arquivado.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/planejamentos/${arquivado.id}/arquivar`)
      .set('Authorization', authorization())
      .expect(200);
    const arquivadoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${arquivado.id}/cancelar`)
      .set('Authorization', authorization());
    expect(arquivadoResponse.status).toBe(422);
    expectDomainError(
      arquivadoResponse,
      'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      PlanejamentoStatus.ARQUIVADO,
    );

    const cancelado = await criarPlanejamento('cancelado invalido');
    await request(app.getHttpServer())
      .patch(`/planejamentos/${cancelado.id}/cancelar`)
      .set('Authorization', authorization())
      .expect(200);
    const repetidoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cancelado.id}/cancelar`)
      .set('Authorization', authorization());
    expect(repetidoResponse.status).toBe(422);
    expectDomainError(
      repetidoResponse,
      'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      PlanejamentoStatus.CANCELADO,
    );

    const semAcessoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cancelado.id}/cancelar`)
      .set('Authorization', authorization(usuarioSemAcesso));
    expect(semAcessoResponse.status).toBe(404);
    expectDomainError(semAcessoResponse, 'PLANEJAMENTO_NOT_FOUND');

    const cenarioParticipante = await criarCenarioFinanceiro(
      'participante nao proprietario',
      true,
    );
    await quitar(cenarioParticipante);
    const participanteResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cenarioParticipante.planejamento.id}/cancelar`)
      .set('Authorization', authorization(participanteVinculado));
    expect(participanteResponse.status).toBe(403);
    expectDomainError(participanteResponse, 'PLANEJAMENTO_OWNER_REQUIRED');
    await expect(
      buscarLogsCancelamento(cenarioParticipante.planejamento.id),
    ).resolves.toHaveLength(0);
  });

  it('serializes concurrent cancellation requests so only the first transition succeeds', async () => {
    const planejamento = await criarPlanejamento('concorrencia cancelar');
    const endpoint = `/planejamentos/${planejamento.id}/cancelar`;

    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 422,
    ]);
    const rejeitada = responses.find((response) => response.status === 422)!;
    expectDomainError(
      rejeitada,
      'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
      PlanejamentoStatus.CANCELADO,
    );
    expectLogCancelamento(await buscarLogsCancelamento(planejamento.id));
  });

  it('serializes closing against cancellation without a lost update', async () => {
    const planejamento = await criarPlanejamento('corrida fechar cancelar');

    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`/planejamentos/${planejamento.id}/fechar`)
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .patch(`/planejamentos/${planejamento.id}/cancelar`)
        .set('Authorization', authorization()),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 422,
    ]);
    const estadoFinal = await dataSource
      .getRepository(Planejamento)
      .findOneByOrFail({ id: planejamento.id });
    expect([
      PlanejamentoStatus.FECHADO,
      PlanejamentoStatus.CANCELADO,
    ]).toContain(estadoFinal.status);
    const rejeitada = responses.find((response) => response.status === 422)!;
    expect([
      'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      'PLANEJAMENTO_CANCELAR_STATUS_INVALIDO',
    ]).toContain((rejeitada.body as { error: { code: string } }).error.code);
  });

  it('rolls back reconciliation when CANCELADO status persistence fails', async () => {
    const cenario = await criarCenarioFinanceiro('rollback');
    await quitar(cenario);
    const acertoObsoleto = await dataSource
      .getRepository(AcertoPlanejamento)
      .save({
        id: randomUUID(),
        planejamentoId: cenario.planejamento.id,
        deParticipanteId: cenario.participanteDevedor.id,
        paraParticipanteId: cenario.participanteProprietario.id,
        valorCentavos: cenario.acerto.valorCentavos,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        observacao: 'Deve sobreviver ao rollback',
      });
    const triggerSuffix = randomUUID().replace(/-/g, '_');
    const functionName = `falhar_cancelamento_${triggerSuffix}`;
    const triggerName = `trigger_${functionName}`;

    await dataSource.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = '${cenario.planejamento.id}' AND NEW.status = 'CANCELADO' THEN
          RAISE EXCEPTION 'falha de cancelamento induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE ON planejamento
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);

    try {
      await request(app.getHttpServer())
        .patch(`/planejamentos/${cenario.planejamento.id}/cancelar`)
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await dataSource.query(`DROP TRIGGER ${triggerName} ON planejamento`);
      await dataSource.query(`DROP FUNCTION ${functionName}()`);
    }

    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: cenario.planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.ABERTO }));
    expect(
      await dataSource.getRepository(AcertoPlanejamento).findOneByOrFail({
        id: acertoObsoleto.id,
      }),
    ).toEqual(expect.objectContaining({ status: AcertoStatus.PENDENTE }));
  });

  it('rolls back status, reconciliation and lifecycle log when transactional audit persistence fails', async () => {
    const cenario = await criarCenarioFinanceiro('rollback auditoria');
    await quitar(cenario);
    const acertoObsoleto = await dataSource
      .getRepository(AcertoPlanejamento)
      .save({
        id: randomUUID(),
        planejamentoId: cenario.planejamento.id,
        deParticipanteId: cenario.participanteDevedor.id,
        paraParticipanteId: cenario.participanteProprietario.id,
        valorCentavos: cenario.acerto.valorCentavos,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        observacao: 'Deve sobreviver ao rollback da auditoria',
      });
    const triggerSuffix = randomUUID().replace(/-/g, '_');
    const functionName = `falhar_auditoria_cancelamento_${triggerSuffix}`;
    const triggerName = `trigger_${functionName}`;

    await dataSource.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.entity_id = '${cenario.planejamento.id}'
          AND NEW.event = 'PLANEJAMENTO_CANCELADO' THEN
          RAISE EXCEPTION 'falha de auditoria induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);

    try {
      await request(app.getHttpServer())
        .patch(`/planejamentos/${cenario.planejamento.id}/cancelar`)
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await dataSource.query(`DROP TRIGGER ${triggerName} ON audit_log`);
      await dataSource.query(`DROP FUNCTION ${functionName}()`);
    }

    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: cenario.planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.ABERTO }));
    expect(
      await dataSource.getRepository(AcertoPlanejamento).findOneByOrFail({
        id: acertoObsoleto.id,
      }),
    ).toEqual(expect.objectContaining({ status: AcertoStatus.PENDENTE }));
    await expect(
      buscarLogsCancelamento(cenario.planejamento.id),
    ).resolves.toHaveLength(0);
  });
});
