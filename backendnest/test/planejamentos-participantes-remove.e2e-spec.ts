import { randomUUID } from 'crypto';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import {
  GastoComportamento,
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoTipo,
} from '../src/planejamentos/enums';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser } from './helpers/auth.e2e-helper';
import { Identifiable, unwrapSuccess } from './helpers/http.helper';

type ParticipanteResponse = Identifiable & {
  status: ParticipanteStatus;
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
};

type GastoResponse = Identifiable & {
  divisoes: Identifiable[];
};

type AuditFailureTrigger = {
  functionName: string;
  triggerName: string;
};

jest.setTimeout(60000);

describe('Planejamentos participant logical removal (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let auditFailureTrigger: AuditFailureTrigger | null = null;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function removerTriggerAuditoria(): Promise<void> {
    if (!auditFailureTrigger) {
      return;
    }

    const { functionName, triggerName } = auditFailureTrigger;
    await dataSource.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON audit_log`,
    );
    await dataSource.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    auditFailureTrigger = null;
  }

  afterEach(async () => {
    await removerTriggerAuditoria();
  });

  async function instalarFalhaAuditoria(
    event: string,
    userId: string,
    entityId?: string,
  ): Promise<void> {
    const suffix = randomUUID().replace(/-/g, '_');
    auditFailureTrigger = {
      functionName: `falhar_auditoria_participante_${suffix}`,
      triggerName: `trigger_falhar_auditoria_participante_${suffix}`,
    };
    const { functionName, triggerName } = auditFailureTrigger;
    const entityIdFilter = entityId ? `AND NEW.entity_id = '${entityId}'` : '';

    await dataSource.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.entity = 'participante_planejamento'
          AND NEW.event = '${event}'
          AND NEW.user_id = '${userId}'
          ${entityIdFilter} THEN
          RAISE EXCEPTION 'falha de auditoria de participante induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
  }

  async function criarPlanejamento(cpf: string, email: string, nome: string) {
    const session = await registerAndLoginTestUser(app, { cpf, email, nome });
    const authorization = `Bearer ${session.token}`;
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({ nome: `Planejamento ${nome}`, tipo: PlanejamentoTipo.VIAGEM })
      .expect(201);
    const planejamento = unwrapSuccess<PlanejamentoResponse>(response);
    const proprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );

    expect(proprietario).toBeDefined();
    return { authorization, planejamento, proprietario, session };
  }

  async function adicionarParticipante(
    planejamentoId: string,
    authorization: string,
    nome: string,
    usuarioId?: string,
  ) {
    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamentoId}/participantes`)
      .set('Authorization', authorization)
      .send({ nome, ...(usuarioId ? { usuarioId } : {}) })
      .expect(201);

    return unwrapSuccess<ParticipanteResponse>(response);
  }

  async function criarGastoComParticipante(
    planejamentoId: string,
    authorization: string,
    proprietarioId: string,
    participanteId: string,
    descricao: string,
  ) {
    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamentoId}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao,
        pagoPorParticipanteId: proprietarioId,
        participantesIds: [proprietarioId, participanteId],
        valorCentavos: 10000,
      })
      .expect(201);

    return unwrapSuccess<GastoResponse>(response);
  }

  function expectErro(response: Response, status: number, code: string): void {
    expect(response.status).toBe(status);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code }) as object,
        success: false,
      }),
    );
  }

  it('audits participant addition once without persisting name or email', async () => {
    const { authorization, planejamento, session } = await criarPlanejamento(
      '15350946056',
      'participante.audit.add.owner.e2e@example.com',
      'Auditoria Adicao E2E',
    );
    const nome = 'Nome que nao deve ir ao log';
    const email = 'participante.sensivel.audit.e2e@example.com';
    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization)
      .send({ email, nome })
      .expect(201);
    const participante = unwrapSuccess<ParticipanteResponse>(response);

    const logs = await dataSource.getRepository(AuditLog).find({
      where: {
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_ADICIONADO',
        userId: session.userId,
      },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: 'create',
        entity: 'participante_planejamento',
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_ADICIONADO',
        module: 'planejamentos',
        statusCode: 201,
        success: true,
        userId: session.userId,
      }),
    );
    expect(logs[0].details).toEqual({
      planejamentoId: planejamento.id,
      tipo: ParticipanteTipo.MANUAL,
      statusPosterior: ParticipanteStatus.ATIVO,
    });
    const serializado = JSON.stringify(logs[0]);
    expect(serializado).not.toContain(nome);
    expect(serializado).not.toContain(email);
  });

  it('rolls back participant addition when audit persistence fails', async () => {
    const { authorization, planejamento, session } = await criarPlanejamento(
      '27551621008',
      'participante.audit.add.rollback.e2e@example.com',
      'Rollback Adicao E2E',
    );
    const participanteRepository = dataSource.getRepository(
      ParticipantePlanejamento,
    );
    const quantidadeAntes = await participanteRepository.countBy({
      planejamentoId: planejamento.id,
    });
    await instalarFalhaAuditoria(
      'PLANEJAMENTO_PARTICIPANTE_ADICIONADO',
      session.userId,
    );

    try {
      await request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/participantes`)
        .set('Authorization', authorization)
        .send({ nome: 'Participante que deve ser revertido' })
        .expect(500);
    } finally {
      await removerTriggerAuditoria();
    }

    await expect(
      participanteRepository.countBy({ planejamentoId: planejamento.id }),
    ).resolves.toBe(quantidadeAntes);
    await expect(
      dataSource.getRepository(AuditLog).countBy({
        event: 'PLANEJAMENTO_PARTICIPANTE_ADICIONADO',
        userId: session.userId,
      }),
    ).resolves.toBe(0);
  });

  it('removes only the participant status and preserves financial history and obligation', async () => {
    const { authorization, planejamento, proprietario, session } =
      await criarPlanejamento(
        '52998224725',
        'participante.remove.principal.e2e@example.com',
        'Remocao Principal E2E',
      );
    const participante = await adicionarParticipante(
      planejamento.id,
      authorization,
      'Participante Historico',
    );
    const gasto = await criarGastoComParticipante(
      planejamento.id,
      authorization,
      proprietario?.id as string,
      participante.id,
      'Gasto preservado apos remocao',
    );
    const gastosAntes = await dataSource
      .getRepository(GastoPlanejamento)
      .count({
        where: { planejamentoId: planejamento.id },
      });
    const divisoesAntes = await dataSource.getRepository(DivisaoGasto).count({
      where: { gastoId: gasto.id },
    });
    const acertosAntes = await dataSource
      .getRepository(AcertoPlanejamento)
      .find({
        where: { planejamentoId: planejamento.id },
      });

    expect(acertosAntes).toHaveLength(1);

    const removalResponse = await request(app.getHttpServer())
      .delete(
        `/planejamentos/${planejamento.id}/participantes/${participante.id}`,
      )
      .set('Authorization', authorization)
      .expect(200);
    const removido = unwrapSuccess<ParticipanteResponse>(removalResponse);

    expect(removido).toEqual(
      expect.objectContaining({
        id: participante.id,
        status: ParticipanteStatus.REMOVIDO,
      }),
    );
    const logsRemocao = await dataSource.getRepository(AuditLog).find({
      where: {
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_REMOVIDO',
        userId: session.userId,
      },
    });
    expect(logsRemocao).toHaveLength(1);
    expect(logsRemocao[0]).toEqual(
      expect.objectContaining({
        action: 'update',
        entity: 'participante_planejamento',
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_REMOVIDO',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
        userId: session.userId,
      }),
    );
    expect(logsRemocao[0].details).toEqual({
      planejamentoId: planejamento.id,
      tipo: ParticipanteTipo.MANUAL,
      statusAnterior: ParticipanteStatus.ATIVO,
      statusPosterior: ParticipanteStatus.REMOVIDO,
    });
    expect(JSON.stringify(logsRemocao[0])).not.toContain(
      'Participante Historico',
    );
    expect(
      await dataSource.getRepository(GastoPlanejamento).count({
        where: { planejamentoId: planejamento.id },
      }),
    ).toBe(gastosAntes);
    expect(
      await dataSource.getRepository(DivisaoGasto).count({
        where: { gastoId: gasto.id },
      }),
    ).toBe(divisoesAntes);
    const acertosDepois = await dataSource
      .getRepository(AcertoPlanejamento)
      .find({ where: { planejamentoId: planejamento.id } });
    const projetarAcertos = (acertos: AcertoPlanejamento[]) =>
      acertos
        .map((acerto) => ({
          devedorParticipanteId: acerto.deParticipanteId,
          id: acerto.id,
          recebedorParticipanteId: acerto.paraParticipanteId,
          status: acerto.status,
          valorCentavos: acerto.valorCentavos,
        }))
        .sort((primeiro, segundo) => primeiro.id.localeCompare(segundo.id));

    expect(acertosDepois).toHaveLength(acertosAntes.length);
    expect(projetarAcertos(acertosDepois)).toEqual(
      projetarAcertos(acertosAntes),
    );

    const acertosResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization)
      .expect(200);
    const obrigacoes =
      unwrapSuccess<
        Array<{ deParticipanteId: string; id: string; valorCentavos: number }>
      >(acertosResponse);
    expect(obrigacoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deParticipanteId: participante.id,
          id: expect.any(String) as string,
          valorCentavos: 5000,
        }),
      ]),
    );

    const novoGasto = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Novo gasto invalido',
        pagoPorParticipanteId: participante.id,
        participantesIds: [proprietario?.id, participante.id],
        valorCentavos: 1000,
      });
    expectErro(novoGasto, 422, 'PLANEJAMENTO_PAGADOR_INVALIDO');

    const novaDivisao = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Nova divisao invalida',
        pagoPorParticipanteId: proprietario?.id,
        participantesIds: [proprietario?.id, participante.id],
        valorCentavos: 1000,
      });
    expectErro(novaDivisao, 422, 'PLANEJAMENTO_DIVISAO_PARTICIPANTE_INVALIDO');
  });

  it('keeps the participant active when removal audit persistence fails', async () => {
    const { authorization, planejamento, session } = await criarPlanejamento(
      '03746552070',
      'participante.audit.remove.rollback.e2e@example.com',
      'Rollback Remocao E2E',
    );
    const participante = await adicionarParticipante(
      planejamento.id,
      authorization,
      'Participante mantido ativo',
    );
    await instalarFalhaAuditoria(
      'PLANEJAMENTO_PARTICIPANTE_REMOVIDO',
      session.userId,
      participante.id,
    );

    try {
      await request(app.getHttpServer())
        .delete(
          `/planejamentos/${planejamento.id}/participantes/${participante.id}`,
        )
        .set('Authorization', authorization)
        .expect(500);
    } finally {
      await removerTriggerAuditoria();
    }

    await expect(
      dataSource.getRepository(ParticipantePlanejamento).findOneByOrFail({
        id: participante.id,
        planejamentoId: planejamento.id,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: ParticipanteStatus.ATIVO }),
    );
    await expect(
      dataSource.getRepository(AuditLog).countBy({
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_REMOVIDO',
      }),
    ).resolves.toBe(0);
  });

  it('enforces owner authorization and planejamento isolation', async () => {
    const primeiro = await criarPlanejamento(
      '39053344705',
      'participante.remove.owner.a.e2e@example.com',
      'Owner A E2E',
    );
    const segundo = await criarPlanejamento(
      '68199965000',
      'participante.remove.owner.b.e2e@example.com',
      'Owner B E2E',
    );
    await adicionarParticipante(
      primeiro.planejamento.id,
      primeiro.authorization,
      'Owner B vinculado',
      segundo.session.userId,
    );
    const alvo = await adicionarParticipante(
      primeiro.planejamento.id,
      primeiro.authorization,
      'Alvo do Owner A',
    );
    const participanteOutroPlanejamento = await adicionarParticipante(
      segundo.planejamento.id,
      segundo.authorization,
      'Participante do planejamento B',
    );

    const forbidden = await request(app.getHttpServer())
      .delete(
        `/planejamentos/${primeiro.planejamento.id}/participantes/${alvo.id}`,
      )
      .set('Authorization', segundo.authorization);
    expectErro(forbidden, 403, 'PLANEJAMENTO_OWNER_REQUIRED');

    const notFound = await request(app.getHttpServer())
      .delete(
        `/planejamentos/${primeiro.planejamento.id}/participantes/${participanteOutroPlanejamento.id}`,
      )
      .set('Authorization', primeiro.authorization);
    expectErro(notFound, 404, 'PLANEJAMENTO_PARTICIPANTE_NOT_FOUND');
  });

  it('does not remove the participant linked to the creator', async () => {
    const { authorization, planejamento, proprietario } =
      await criarPlanejamento(
        '11144477735',
        'participante.remove.proprietario.e2e@example.com',
        'Proprietario Protegido E2E',
      );

    const response = await request(app.getHttpServer())
      .delete(
        `/planejamentos/${planejamento.id}/participantes/${proprietario?.id}`,
      )
      .set('Authorization', authorization);

    expectErro(
      response,
      422,
      'PLANEJAMENTO_PARTICIPANTE_PROPRIETARIO_NAO_REMOVIVEL',
    );
  });

  it('serializes two concurrent removals of the same participant', async () => {
    const { authorization, planejamento, proprietario, session } =
      await criarPlanejamento(
        '10000001090',
        'participante.remove.concorrente.e2e@example.com',
        'Remocao Concorrente E2E',
      );
    const participante = await adicionarParticipante(
      planejamento.id,
      authorization,
      'Participante Concorrente',
    );
    const gasto = await criarGastoComParticipante(
      planejamento.id,
      authorization,
      proprietario?.id as string,
      participante.id,
      'Historico concorrente',
    );
    const endpoint = `/planejamentos/${planejamento.id}/participantes/${participante.id}`;

    const respostas = await Promise.all([
      request(app.getHttpServer())
        .delete(endpoint)
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .delete(endpoint)
        .set('Authorization', authorization),
    ]);

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([
      200, 422,
    ]);
    const invalida = respostas.find((resposta) => resposta.status === 422);
    expect(invalida?.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_PARTICIPANTE_REMOVER_STATUS_INVALIDO',
        }) as object,
      }),
    );
    const persistido = await dataSource
      .getRepository(ParticipantePlanejamento)
      .findOneByOrFail({
        id: participante.id,
        planejamentoId: planejamento.id,
      });
    expect(persistido.status).toBe(ParticipanteStatus.REMOVIDO);
    expect(
      await dataSource.getRepository(GastoPlanejamento).count({
        where: { id: gasto.id, planejamentoId: planejamento.id },
      }),
    ).toBe(1);
    expect(
      await dataSource.getRepository(DivisaoGasto).count({
        where: { gastoId: gasto.id },
      }),
    ).toBe(2);
    expect(
      await dataSource.getRepository(AcertoPlanejamento).count({
        where: { planejamentoId: planejamento.id },
      }),
    ).toBe(1);
    await expect(
      dataSource.getRepository(AuditLog).countBy({
        entityId: participante.id,
        event: 'PLANEJAMENTO_PARTICIPANTE_REMOVIDO',
        userId: session.userId,
      }),
    ).resolves.toBe(1);
  });
});
