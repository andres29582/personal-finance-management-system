import { randomUUID } from 'crypto';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { Planejamento } from '../src/planejamentos/entities/planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
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

type GastoResponse = Identifiable;

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

describe('Planejamentos archive lifecycle (e2e)', () => {
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
      email: 'planejamento.arquivar.owner.e2e@example.com',
      nome: 'Proprietario Arquivamento E2E',
    });
    participanteVinculado = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.arquivar.participant.e2e@example.com',
      nome: 'Participante Arquivamento E2E',
    });
    usuarioSemAcesso = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'planejamento.arquivar.outsider.e2e@example.com',
      nome: 'Usuario Sem Acesso Arquivamento E2E',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const authorization = (session = proprietario) => `Bearer ${session.token}`;

  async function buscarLogsArquivamento(
    planejamentoId: string,
  ): Promise<AuditLog[]> {
    return dataSource.getRepository(AuditLog).find({
      where: {
        entity: 'planejamento',
        entityId: planejamentoId,
        event: 'PLANEJAMENTO_ARQUIVADO',
      },
    });
  }

  function expectLogArquivamento(logs: AuditLog[]): void {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: 'update',
        entity: 'planejamento',
        event: 'PLANEJAMENTO_ARQUIVADO',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
        userId: proprietario.userId,
      }),
    );
    expect(logs[0].details).toEqual({
      statusAnterior: PlanejamentoStatus.FECHADO,
      statusPosterior: PlanejamentoStatus.ARQUIVADO,
    });
  }

  async function criarPlanejamento(
    sufixo: string,
  ): Promise<PlanejamentoResponse> {
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: `Arquivamento ${sufixo}`,
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

  async function fechar(planejamentoId: string): Promise<void> {
    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamentoId}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
  }

  async function quitar(cenario: CenarioFinanceiro): Promise<void> {
    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenario.planejamento.id}/acertos/${cenario.acerto.id}/pagar`,
      )
      .set('Authorization', authorization())
      .expect(200);
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

  it('archives FECHADO + QUITADO and keeps every query available while blocking all mutations', async () => {
    const cenario = await criarCenarioFinanceiro('somente leitura');
    await fechar(cenario.planejamento.id);
    await quitar(cenario);

    const arquivamentoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cenario.planejamento.id}/arquivar`)
      .set('Authorization', authorization())
      .expect(200);

    expect(unwrapSuccess<PlanejamentoResponse>(arquivamentoResponse)).toEqual(
      expect.objectContaining({
        id: cenario.planejamento.id,
        status: PlanejamentoStatus.ARQUIVADO,
      }),
    );
    const logs = await buscarLogsArquivamento(cenario.planejamento.id);
    expect(logs[0]).toEqual(
      expect.objectContaining({ entityId: cenario.planejamento.id }),
    );
    expectLogArquivamento(logs);

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
        statusOperacional: PlanejamentoStatus.ARQUIVADO,
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
        PlanejamentoStatus.ARQUIVADO,
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
        PlanejamentoStatus.ARQUIVADO,
      );
    }
  });

  it('rejects ABERTO, FECHADO + PENDENTE, inaccessible and non-owner archive requests', async () => {
    const aberto = await criarPlanejamento('aberto invalido');
    const abertoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${aberto.id}/arquivar`)
      .set('Authorization', authorization());
    expect(abertoResponse.status).toBe(422);
    expectDomainError(
      abertoResponse,
      'PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO',
      PlanejamentoStatus.ABERTO,
    );

    const pendente = await criarCenarioFinanceiro('pendente invalido');
    await fechar(pendente.planejamento.id);
    const pendenteResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${pendente.planejamento.id}/arquivar`)
      .set('Authorization', authorization());
    expect(pendenteResponse.status).toBe(422);
    expectDomainError(
      pendenteResponse,
      'PLANEJAMENTO_ARQUIVAR_PENDENCIA_FINANCEIRA',
    );
    const pendenteBody = pendenteResponse.body as {
      error: { details: Record<string, unknown> };
    };
    expect(pendenteBody.error.details).toEqual({
      situacaoFinanceira: 'PENDENTE',
      obrigacaoResidualCentavos: 5000,
    });

    const semAcessoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${aberto.id}/arquivar`)
      .set('Authorization', authorization(usuarioSemAcesso));
    expect(semAcessoResponse.status).toBe(404);
    expectDomainError(semAcessoResponse, 'PLANEJAMENTO_NOT_FOUND');

    const cenarioParticipante = await criarCenarioFinanceiro(
      'participante nao proprietario',
      true,
    );
    await fechar(cenarioParticipante.planejamento.id);
    const participanteResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${cenarioParticipante.planejamento.id}/arquivar`)
      .set('Authorization', authorization(participanteVinculado));
    expect(participanteResponse.status).toBe(403);
    expectDomainError(participanteResponse, 'PLANEJAMENTO_OWNER_REQUIRED');
    await expect(
      buscarLogsArquivamento(cenarioParticipante.planejamento.id),
    ).resolves.toHaveLength(0);
  });

  it('serializes concurrent archive requests so only the first transition succeeds', async () => {
    const cenario = await criarCenarioFinanceiro('concorrencia');
    await fechar(cenario.planejamento.id);
    await quitar(cenario);
    const endpoint = `/planejamentos/${cenario.planejamento.id}/arquivar`;

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
      'PLANEJAMENTO_ARQUIVAR_STATUS_INVALIDO',
      PlanejamentoStatus.ARQUIVADO,
    );
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: cenario.planejamento.id,
      }),
    ).toEqual(
      expect.objectContaining({ status: PlanejamentoStatus.ARQUIVADO }),
    );
    expectLogArquivamento(
      await buscarLogsArquivamento(cenario.planejamento.id),
    );
  });

  it('rolls back settlement reconciliation when archive status persistence fails', async () => {
    const cenario = await criarCenarioFinanceiro('rollback');
    await fechar(cenario.planejamento.id);
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
    const functionName = `falhar_arquivamento_${triggerSuffix}`;
    const triggerName = `trigger_${functionName}`;

    await dataSource.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = '${cenario.planejamento.id}' AND NEW.status = 'ARQUIVADO' THEN
          RAISE EXCEPTION 'falha de arquivamento induzida pelo teste';
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
        .patch(`/planejamentos/${cenario.planejamento.id}/arquivar`)
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
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.FECHADO }));
    expect(
      await dataSource.getRepository(AcertoPlanejamento).findOneByOrFail({
        id: acertoObsoleto.id,
      }),
    ).toEqual(expect.objectContaining({ status: AcertoStatus.PENDENTE }));
  });
});
