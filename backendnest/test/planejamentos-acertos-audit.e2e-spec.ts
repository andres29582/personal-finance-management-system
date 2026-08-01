import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
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
};

type AcertoResponse = Identifiable & {
  dataPagamento: string | null;
  deParticipanteId: string;
  observacao: string | null;
  paraParticipanteId: string;
  status: AcertoStatus;
  valorCentavos: number;
};

type CenarioAcertos = {
  acertos: AcertoResponse[];
  participantesDevedores: ParticipanteResponse[];
  participanteProprietario: ParticipanteResponse;
  planejamento: PlanejamentoResponse;
};

type AuditFailureTrigger = {
  functionName: string;
  triggerName: string;
};

const OBSERVACAO_SIGILOSA =
  'OBSERVACAO_ACERTO_QUE_NAO_DEVE_APARECER_NA_AUDITORIA';

jest.setTimeout(120000);

describe('Planejamentos settlements transactional audit (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let auditFailureTriggers: AuditFailureTrigger[] = [];

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamentos.acertos.audit.e2e@example.com',
      nome: 'Proprietario Auditoria Acertos E2E',
    });
  });

  async function removerTriggerAuditoria(
    trigger: AuditFailureTrigger,
  ): Promise<void> {
    await dataSource.query(
      `DROP TRIGGER IF EXISTS ${trigger.triggerName} ON audit_log`,
    );
    await dataSource.query(`DROP FUNCTION IF EXISTS ${trigger.functionName}()`);
    auditFailureTriggers = auditFailureTriggers.filter(
      (item) => item.triggerName !== trigger.triggerName,
    );
  }

  async function removerTodosTriggersAuditoria(): Promise<void> {
    for (const trigger of [...auditFailureTriggers]) {
      await removerTriggerAuditoria(trigger);
    }
  }

  afterEach(async () => {
    await removerTodosTriggersAuditoria();
  });

  afterAll(async () => {
    await removerTodosTriggersAuditoria();
    await app?.close();
  });

  const authorization = () => `Bearer ${proprietario.token}`;

  async function criarTriggerFalhaAuditoria(params: {
    entity: string;
    entityId: string;
    event: string;
  }): Promise<AuditFailureTrigger> {
    const suffix = randomUUID().replace(/-/g, '_');
    const trigger = {
      functionName: `falhar_auditoria_acerto_${suffix}`,
      triggerName: `trigger_falhar_auditoria_acerto_${suffix}`,
    };
    auditFailureTriggers.push(trigger);

    try {
      await dataSource.query(`
        CREATE FUNCTION ${trigger.functionName}() RETURNS trigger AS $$
        BEGIN
          IF NEW.event = '${params.event}'
            AND NEW.entity = '${params.entity}'
            AND NEW.entity_id = '${params.entityId}'
            AND NEW.user_id = '${proprietario.userId}' THEN
            RAISE EXCEPTION 'falha de auditoria induzida pelo teste';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER ${trigger.triggerName}
        BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION ${trigger.functionName}();
      `);
    } catch (error) {
      await removerTriggerAuditoria(trigger);
      throw error;
    }

    return trigger;
  }

  async function criarCenarioAcertos(
    sufixo: string,
    quantidadeDevedores = 1,
  ): Promise<CenarioAcertos> {
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: `Planejamento acertos audit ${sufixo}`,
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === proprietario.userId,
    );

    if (!participanteProprietario) {
      throw new Error('Participante proprietario nao retornado pela API.');
    }

    const participantesDevedores: ParticipanteResponse[] = [];
    for (let indice = 0; indice < quantidadeDevedores; indice += 1) {
      const participanteResponse = await request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/participantes`)
        .set('Authorization', authorization())
        .send({ nome: `Participante ${sufixo} ${indice + 1}` })
        .expect(201);
      participantesDevedores.push(
        unwrapSuccess<ParticipanteResponse>(participanteResponse),
      );
    }

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization())
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-20',
        descricao: `Gasto operacional ${sufixo}`,
        pagoPorParticipanteId: participanteProprietario.id,
        participantesIds: [
          participanteProprietario.id,
          ...participantesDevedores.map(({ id }) => id),
        ],
        valorCentavos: 12000 * (quantidadeDevedores + 1),
      })
      .expect(201);

    const acertosResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization())
      .expect(200);
    const acertos = unwrapSuccess<AcertoResponse[]>(acertosResponse).sort(
      (a, b) => a.id.localeCompare(b.id),
    );

    expect(acertos).toHaveLength(quantidadeDevedores);
    for (const participante of participantesDevedores) {
      expect(acertos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            deParticipanteId: participante.id,
            paraParticipanteId: participanteProprietario.id,
            status: AcertoStatus.PENDENTE,
            valorCentavos: 12000,
          }),
        ]),
      );
    }

    return {
      acertos,
      participantesDevedores,
      participanteProprietario,
      planejamento,
    };
  }

  async function criarAcertoObsoleto(
    referencia: AcertoResponse,
    planejamentoId: string,
    incremento: number,
  ): Promise<AcertoPlanejamento> {
    const repository = dataSource.getRepository(AcertoPlanejamento);
    return repository.save(
      repository.create({
        id: randomUUID(),
        planejamentoId,
        deParticipanteId: referencia.deParticipanteId,
        paraParticipanteId: referencia.paraParticipanteId,
        valorCentavos: referencia.valorCentavos + incremento,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        observacao: OBSERVACAO_SIGILOSA,
      }),
    );
  }

  async function buscarLogs(params: {
    entity: string;
    entityId: string;
    event: string;
  }): Promise<AuditLog[]> {
    return dataSource.getRepository(AuditLog).find({
      where: {
        ...params,
        userId: proprietario.userId,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  function expectContratoLog(
    logs: AuditLog[],
    contrato: {
      action: string;
      details: Record<string, unknown>;
      entity: string;
      entityId: string;
      event: string;
      statusCode: number;
    },
  ): AuditLog {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: contrato.action,
        entity: contrato.entity,
        entityId: contrato.entityId,
        event: contrato.event,
        module: 'planejamentos',
        statusCode: contrato.statusCode,
        success: true,
        userId: proprietario.userId,
      }),
    );
    expect(logs[0].details).toEqual(contrato.details);
    const logSerializado = JSON.stringify(logs[0]);
    expect(logSerializado).not.toContain(OBSERVACAO_SIGILOSA);
    expect(logSerializado).not.toContain('"observacao"');
    return logs[0];
  }

  async function snapshotAcertos(planejamentoId: string) {
    const acertos = await dataSource.getRepository(AcertoPlanejamento).find({
      where: { planejamentoId },
      order: { id: 'ASC' },
    });

    return acertos.map((acerto) => ({
      createdAt: acerto.createdAt.toISOString(),
      dataPagamento: acerto.dataPagamento?.toISOString() ?? null,
      deParticipanteId: acerto.deParticipanteId,
      id: acerto.id,
      observacao: acerto.observacao,
      paraParticipanteId: acerto.paraParticipanteId,
      planejamentoId: acerto.planejamentoId,
      status: acerto.status,
      updatedAt: acerto.updatedAt.toISOString(),
      valorCentavos: acerto.valorCentavos,
    }));
  }

  async function prepararPagamentoComDerivados(sufixo: string) {
    const cenario = await criarCenarioAcertos(sufixo, 2);
    const [alvo, acertoAusente] = cenario.acertos;
    const repository = dataSource.getRepository(AcertoPlanejamento);

    await repository.delete({ id: acertoAusente.id });
    const acertoObsoleto = await criarAcertoObsoleto(
      acertoAusente,
      cenario.planejamento.id,
      777,
    );
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });

    return { acertoAusente, acertoObsoleto, alvo, cenario };
  }

  async function pagarAcerto(
    planejamentoId: string,
    acertoId: string,
  ): Promise<AcertoResponse> {
    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamentoId}/acertos/${acertoId}/pagar`)
      .set('Authorization', authorization())
      .expect(200);
    return unwrapSuccess<AcertoResponse>(response);
  }

  it('persists one aggregate synchronization event with sorted created and cancelled ids only', async () => {
    const cenario = await criarCenarioAcertos('sincronizacao sucesso', 3);
    const [preservado, ...removidos] = cenario.acertos;
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.delete({ id: In(removidos.map(({ id }) => id)) });
    const obsoletos = await Promise.all(
      removidos.map((acerto, indice) =>
        criarAcertoObsoleto(acerto, cenario.planejamento.id, 101 + indice),
      ),
    );

    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${cenario.planejamento.id}/acertos/sincronizar`)
      .set('Authorization', authorization())
      .expect(201);
    const acertosAtuais = unwrapSuccess<AcertoResponse[]>(response);
    const idsCriados = acertosAtuais
      .filter(({ id }) => id !== preservado.id)
      .map(({ id }) => id)
      .sort((a, b) => a.localeCompare(b));
    const idsCancelados = obsoletos
      .map(({ id }) => id)
      .sort((a, b) => a.localeCompare(b));

    expect(idsCriados).toHaveLength(2);
    expect(idsCancelados).toHaveLength(2);
    expect(acertosAtuais).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: preservado.id,
          status: AcertoStatus.PENDENTE,
        }),
      ]),
    );
    const logs = await buscarLogs({
      entity: 'planejamento',
      entityId: cenario.planejamento.id,
      event: 'PLANEJAMENTO_ACERTOS_SINCRONIZADOS',
    });
    const log = expectContratoLog(logs, {
      action: 'update',
      entity: 'planejamento',
      entityId: cenario.planejamento.id,
      event: 'PLANEJAMENTO_ACERTOS_SINCRONIZADOS',
      statusCode: 201,
      details: {
        planejamentoId: cenario.planejamento.id,
        acertosCriadosIds: idsCriados,
        acertosCanceladosIds: idsCancelados,
      },
    });
    expect(log.details?.acertosCriadosIds).toEqual(
      [...idsCriados].sort((a, b) => a.localeCompare(b)),
    );
    expect(log.details?.acertosCanceladosIds).toEqual(
      [...idsCancelados].sort((a, b) => a.localeCompare(b)),
    );
    expect(log.details?.acertosCriadosIds).not.toContain(preservado.id);
    expect(log.details?.acertosCanceladosIds).not.toContain(preservado.id);
  });

  it('does not audit or change settlements when synchronization is a no-op', async () => {
    const cenario = await criarCenarioAcertos('sincronizacao noop');
    const snapshotAntes = await snapshotAcertos(cenario.planejamento.id);

    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${cenario.planejamento.id}/acertos/sincronizar`)
      .set('Authorization', authorization())
      .expect(201);

    expect(unwrapSuccess<AcertoResponse[]>(response)).toEqual([
      expect.objectContaining({ id: cenario.acertos[0].id }),
    ]);
    await expect(snapshotAcertos(cenario.planejamento.id)).resolves.toEqual(
      snapshotAntes,
    );
    await expect(
      buscarLogs({
        entity: 'planejamento',
        entityId: cenario.planejamento.id,
        event: 'PLANEJAMENTO_ACERTOS_SINCRONIZADOS',
      }),
    ).resolves.toHaveLength(0);
  });

  it('rolls back the complete settlement snapshot when synchronization audit fails', async () => {
    const cenario = await criarCenarioAcertos('sincronizacao rollback', 2);
    const [preservado, removido] = cenario.acertos;
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.delete({ id: removido.id });
    await criarAcertoObsoleto(removido, cenario.planejamento.id, 333);
    const snapshotAntes = await snapshotAcertos(cenario.planejamento.id);
    const trigger = await criarTriggerFalhaAuditoria({
      entity: 'planejamento',
      entityId: cenario.planejamento.id,
      event: 'PLANEJAMENTO_ACERTOS_SINCRONIZADOS',
    });

    try {
      await request(app.getHttpServer())
        .post(`/planejamentos/${cenario.planejamento.id}/acertos/sincronizar`)
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await removerTriggerAuditoria(trigger);
    }

    await expect(snapshotAcertos(cenario.planejamento.id)).resolves.toEqual(
      snapshotAntes,
    );
    expect(snapshotAntes.map(({ id }) => id)).toContain(preservado.id);
    await expect(
      buscarLogs({
        entity: 'planejamento',
        entityId: cenario.planejamento.id,
        event: 'PLANEJAMENTO_ACERTOS_SINCRONIZADOS',
      }),
    ).resolves.toHaveLength(0);
  });

  it('persists the payment event with target data and derived changes', async () => {
    const { acertoAusente, acertoObsoleto, alvo, cenario } =
      await prepararPagamentoComDerivados('pagamento sucesso');

    const pago = await pagarAcerto(cenario.planejamento.id, alvo.id);
    expect(pago).toEqual(
      expect.objectContaining({
        dataPagamento: expect.any(String) as string,
        id: alvo.id,
        status: AcertoStatus.PAGO,
      }),
    );
    const persistidos = await dataSource
      .getRepository(AcertoPlanejamento)
      .find({ where: { planejamentoId: cenario.planejamento.id } });
    const criado = persistidos.find(
      (acerto) =>
        acerto.status === AcertoStatus.PENDENTE &&
        acerto.deParticipanteId === acertoAusente.deParticipanteId &&
        acerto.valorCentavos === acertoAusente.valorCentavos,
    );
    expect(criado).toBeDefined();
    expect(persistidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: acertoObsoleto.id,
          status: AcertoStatus.CANCELADO,
        }),
      ]),
    );

    expectContratoLog(
      await buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_PAGO',
      }),
      {
        action: 'update',
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_PAGO',
        statusCode: 200,
        details: {
          planejamentoId: cenario.planejamento.id,
          statusAnterior: AcertoStatus.PENDENTE,
          statusPosterior: AcertoStatus.PAGO,
          valorCentavos: alvo.valorCentavos,
          deParticipanteId: alvo.deParticipanteId,
          paraParticipanteId: alvo.paraParticipanteId,
          acertosCriadosIds: [criado!.id],
          acertosCanceladosIds: [acertoObsoleto.id],
        },
      },
    );
  });

  it('rolls back payment, payment date and derived reconciliation when audit fails', async () => {
    const { alvo, cenario } =
      await prepararPagamentoComDerivados('pagamento rollback');
    const snapshotAntes = await snapshotAcertos(cenario.planejamento.id);
    const trigger = await criarTriggerFalhaAuditoria({
      entity: 'acerto_planejamento',
      entityId: alvo.id,
      event: 'PLANEJAMENTO_ACERTO_PAGO',
    });

    try {
      await request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/pagar`,
        )
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await removerTriggerAuditoria(trigger);
    }

    await expect(snapshotAcertos(cenario.planejamento.id)).resolves.toEqual(
      snapshotAntes,
    );
    await expect(
      dataSource.getRepository(AcertoPlanejamento).findOneByOrFail({
        id: alvo.id,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        dataPagamento: null,
        status: AcertoStatus.PENDENTE,
      }),
    );
    await expect(
      buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_PAGO',
      }),
    ).resolves.toHaveLength(0);
  });

  it('persists pending cancellation without dataPagamentoAnterior', async () => {
    const cenario = await criarCenarioAcertos('cancelamento pendente sucesso');
    const alvo = cenario.acertos[0];
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });

    const response = await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/cancelar`,
      )
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(response)).toEqual(
      expect.objectContaining({ id: alvo.id, status: AcertoStatus.CANCELADO }),
    );
    const substituto = await repository.findOneByOrFail({
      planejamentoId: cenario.planejamento.id,
      status: AcertoStatus.PENDENTE,
    });
    const log = expectContratoLog(
      await buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
      }),
      {
        action: 'update',
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
        statusCode: 200,
        details: {
          planejamentoId: cenario.planejamento.id,
          statusAnterior: AcertoStatus.PENDENTE,
          statusPosterior: AcertoStatus.CANCELADO,
          valorCentavos: alvo.valorCentavos,
          deParticipanteId: alvo.deParticipanteId,
          paraParticipanteId: alvo.paraParticipanteId,
          acertosCriadosIds: [substituto.id],
          acertosCanceladosIds: [],
        },
      },
    );
    expect(log.details).not.toHaveProperty('dataPagamentoAnterior');
  });

  it('rolls back pending cancellation and replacement when audit fails', async () => {
    const cenario = await criarCenarioAcertos('cancelamento pendente rollback');
    const alvo = cenario.acertos[0];
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });
    const snapshotAntes = await snapshotAcertos(cenario.planejamento.id);
    const trigger = await criarTriggerFalhaAuditoria({
      entity: 'acerto_planejamento',
      entityId: alvo.id,
      event: 'PLANEJAMENTO_ACERTO_CANCELADO',
    });

    try {
      await request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/cancelar`,
        )
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await removerTriggerAuditoria(trigger);
    }

    await expect(snapshotAcertos(cenario.planejamento.id)).resolves.toEqual(
      snapshotAntes,
    );
    await expect(repository.findOneByOrFail({ id: alvo.id })).resolves.toEqual(
      expect.objectContaining({
        dataPagamento: null,
        status: AcertoStatus.PENDENTE,
      }),
    );
    await expect(
      buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
      }),
    ).resolves.toHaveLength(0);
  });

  it('persists paid cancellation with the original payment date', async () => {
    const cenario = await criarCenarioAcertos('cancelamento pago sucesso');
    const alvo = cenario.acertos[0];
    await pagarAcerto(cenario.planejamento.id, alvo.id);
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });
    const pago = await repository.findOneByOrFail({ id: alvo.id });

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/cancelar`,
      )
      .set('Authorization', authorization())
      .expect(200);
    const substituto = await repository.findOneByOrFail({
      planejamentoId: cenario.planejamento.id,
      status: AcertoStatus.PENDENTE,
    });

    expectContratoLog(
      await buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
      }),
      {
        action: 'update',
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
        statusCode: 200,
        details: {
          planejamentoId: cenario.planejamento.id,
          statusAnterior: AcertoStatus.PAGO,
          statusPosterior: AcertoStatus.CANCELADO,
          valorCentavos: alvo.valorCentavos,
          deParticipanteId: alvo.deParticipanteId,
          paraParticipanteId: alvo.paraParticipanteId,
          dataPagamentoAnterior: pago.dataPagamento?.toISOString(),
          acertosCriadosIds: [substituto.id],
          acertosCanceladosIds: [],
        },
      },
    );
  });

  it('rolls back paid cancellation, payment date and reconciliation when audit fails', async () => {
    const cenario = await criarCenarioAcertos('cancelamento pago rollback');
    const alvo = cenario.acertos[0];
    await pagarAcerto(cenario.planejamento.id, alvo.id);
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });
    const pagoAntes = await repository.findOneByOrFail({ id: alvo.id });
    const snapshotAntes = await snapshotAcertos(cenario.planejamento.id);
    const trigger = await criarTriggerFalhaAuditoria({
      entity: 'acerto_planejamento',
      entityId: alvo.id,
      event: 'PLANEJAMENTO_ACERTO_CANCELADO',
    });

    try {
      await request(app.getHttpServer())
        .patch(
          `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/cancelar`,
        )
        .set('Authorization', authorization())
        .expect(500);
    } finally {
      await removerTriggerAuditoria(trigger);
    }

    await expect(snapshotAcertos(cenario.planejamento.id)).resolves.toEqual(
      snapshotAntes,
    );
    await expect(repository.findOneByOrFail({ id: alvo.id })).resolves.toEqual(
      expect.objectContaining({
        dataPagamento: pagoAntes.dataPagamento,
        status: AcertoStatus.PAGO,
      }),
    );
    await expect(
      buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_CANCELADO',
      }),
    ).resolves.toHaveLength(0);
  });

  it('preserves the legacy reopening event and persists the enriched contract', async () => {
    const cenario = await criarCenarioAcertos('reabertura contrato');
    const alvo = cenario.acertos[0];
    await pagarAcerto(cenario.planejamento.id, alvo.id);
    const repository = dataSource.getRepository(AcertoPlanejamento);
    await repository.update(alvo.id, { observacao: OBSERVACAO_SIGILOSA });
    const pago = await repository.findOneByOrFail({ id: alvo.id });
    const duplicado = await repository.save(
      repository.create({
        id: randomUUID(),
        planejamentoId: cenario.planejamento.id,
        deParticipanteId: alvo.deParticipanteId,
        paraParticipanteId: alvo.paraParticipanteId,
        valorCentavos: alvo.valorCentavos,
        status: AcertoStatus.PENDENTE,
        dataPagamento: null,
        observacao: OBSERVACAO_SIGILOSA,
      }),
    );

    const response = await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenario.planejamento.id}/acertos/${alvo.id}/reabrir`,
      )
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(response)).toEqual(
      expect.objectContaining({
        dataPagamento: null,
        id: alvo.id,
        status: AcertoStatus.PENDENTE,
      }),
    );
    await expect(
      repository.findOneByOrFail({ id: duplicado.id }),
    ).resolves.toEqual(
      expect.objectContaining({ status: AcertoStatus.CANCELADO }),
    );

    expectContratoLog(
      await buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'ACERTO_PLANEJAMENTO_REABERTO',
      }),
      {
        action: 'update',
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'ACERTO_PLANEJAMENTO_REABERTO',
        statusCode: 200,
        details: {
          planejamentoId: cenario.planejamento.id,
          statusAnterior: AcertoStatus.PAGO,
          statusPosterior: AcertoStatus.PENDENTE,
          valorCentavos: alvo.valorCentavos,
          deParticipanteId: alvo.deParticipanteId,
          paraParticipanteId: alvo.paraParticipanteId,
          dataPagamentoAnterior: pago.dataPagamento?.toISOString(),
          acertosCriadosIds: [],
          acertosCanceladosIds: [duplicado.id],
        },
      },
    );
    await expect(
      buscarLogs({
        entity: 'acerto_planejamento',
        entityId: alvo.id,
        event: 'PLANEJAMENTO_ACERTO_REABERTO',
      }),
    ).resolves.toHaveLength(0);
  });
});
