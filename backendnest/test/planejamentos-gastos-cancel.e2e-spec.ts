import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import {
  AcertoStatus,
  DivisaoStatus,
  GastoComportamento,
  GastoStatus,
  PlanejamentoTipo,
} from '../src/planejamentos/enums';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser } from './helpers/auth.e2e-helper';
import { Identifiable, unwrapSuccess } from './helpers/http.helper';

type ParticipanteResponse = Identifiable & {
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
};

type GastoResponse = Identifiable & {
  divisoes: Array<Identifiable & { status: DivisaoStatus }>;
  status: GastoStatus;
};

type AcertoResponse = Identifiable & {
  status: AcertoStatus;
};

type AuditFailureTrigger = {
  functionName: string;
  triggerName: string;
};

const snapshotAcertos = (acertos: AcertoPlanejamento[]) =>
  [...acertos]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((acerto) => ({
      dataPagamento: acerto.dataPagamento?.toISOString() ?? null,
      deParticipanteId: acerto.deParticipanteId,
      id: acerto.id,
      observacao: acerto.observacao,
      paraParticipanteId: acerto.paraParticipanteId,
      status: acerto.status,
      valorCentavos: acerto.valorCentavos,
    }));

jest.setTimeout(60000);

describe('Planejamentos expense cancellation (e2e)', () => {
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

  async function instalarFalhaAuditoriaCancelamento(
    gastoId: string,
    userId: string,
  ): Promise<void> {
    const suffix = randomUUID().replace(/-/g, '_');
    auditFailureTrigger = {
      functionName: `falhar_auditoria_cancelamento_gasto_${suffix}`,
      triggerName: `trigger_falhar_auditoria_cancelamento_gasto_${suffix}`,
    };
    const { functionName, triggerName } = auditFailureTrigger;

    await dataSource.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.entity = 'gasto_planejamento'
          AND NEW.event = 'PLANEJAMENTO_GASTO_CANCELADO'
          AND NEW.entity_id = '${gastoId}'
          AND NEW.user_id = '${userId}' THEN
          RAISE EXCEPTION 'falha de auditoria de cancelamento induzida pelo teste';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_log
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
  }

  it('logically cancels an expense and reconciles settlements without removing history', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.cancelar.gasto.e2e@example.com',
      nome: 'Cancelar Gasto E2E',
    });
    const authorization = `Bearer ${session.token}`;
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Viagem com cancelamento de gasto',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );

    expect(participanteProprietario).toBeDefined();

    const participanteResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization)
      .send({ nome: 'Participante devedor' })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);
    const criarGasto = (descricao: string, valorCentavos: number) =>
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/gastos`)
        .set('Authorization', authorization)
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-14',
          descricao,
          pagoPorParticipanteId: participanteProprietario?.id,
          participantesIds: [
            participanteProprietario?.id,
            participanteDevedor.id,
          ],
          valorCentavos,
        });

    await criarGasto('Gasto historico pago', 10000).expect(201);

    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const [acertoInicial] = await acertoRepository.find({
      where: {
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      },
    });

    expect(acertoInicial).toBeDefined();

    const pagamentoResponse = await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/acertos/${acertoInicial?.id}/pagar`,
      )
      .set('Authorization', authorization)
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(pagamentoResponse).status).toBe(
      AcertoStatus.PAGO,
    );

    const acertoHistoricoCancelado = await acertoRepository.save(
      Object.assign(new AcertoPlanejamento(), {
        id: randomUUID(),
        planejamentoId: planejamento.id,
        deParticipanteId: participanteProprietario?.id,
        paraParticipanteId: participanteDevedor.id,
        valorCentavos: 321,
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
        observacao: 'Historico anterior ao cancelamento do gasto',
      }),
    );
    const acertoHistoricoConfirmado = await acertoRepository.save(
      Object.assign(new AcertoPlanejamento(), {
        id: randomUUID(),
        planejamentoId: planejamento.id,
        deParticipanteId: participanteDevedor.id,
        paraParticipanteId: participanteProprietario?.id,
        valorCentavos: 321,
        status: AcertoStatus.CONFIRMADO,
        dataPagamento: new Date('2026-07-14T12:00:00.000Z'),
        observacao: 'Historico confirmado anterior ao cancelamento do gasto',
      }),
    );

    const gastoResponse = await criarGasto('Gasto a cancelar', 4000).expect(
      201,
    );
    const gastoCriado = unwrapSuccess<GastoResponse>(gastoResponse);

    const respostaCancelamento = await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/gastos/${gastoCriado.id}/cancelar`,
      )
      .set('Authorization', authorization)
      .expect(200);
    const gastoCancelado = unwrapSuccess<GastoResponse>(respostaCancelamento);

    expect(gastoCancelado).toEqual(
      expect.objectContaining({
        id: gastoCriado.id,
        status: GastoStatus.CANCELADO,
      }),
    );
    expect(gastoCancelado.divisoes).toHaveLength(2);
    expect(
      gastoCancelado.divisoes.every(
        (divisao) => divisao.status === DivisaoStatus.CANCELADA,
      ),
    ).toBe(true);

    const gastoPersistido = await dataSource
      .getRepository(GastoPlanejamento)
      .findOneOrFail({
        relations: { divisoes: true },
        where: {
          id: gastoCriado.id,
          planejamentoId: planejamento.id,
        },
      });
    expect(gastoPersistido.status).toBe(GastoStatus.CANCELADO);
    expect(gastoPersistido.divisoes).toHaveLength(2);
    expect(
      gastoPersistido.divisoes.every(
        (divisao) => divisao.status === DivisaoStatus.CANCELADA,
      ),
    ).toBe(true);
    expect(
      await dataSource.getRepository(DivisaoGasto).count({
        where: { gastoId: gastoCriado.id },
      }),
    ).toBe(2);

    const logsCancelamento = await dataSource.getRepository(AuditLog).find({
      where: {
        entityId: gastoCriado.id,
        event: 'PLANEJAMENTO_GASTO_CANCELADO',
        userId: session.userId,
      },
    });
    expect(logsCancelamento).toHaveLength(1);
    expect(logsCancelamento[0]).toEqual(
      expect.objectContaining({
        action: 'update',
        entity: 'gasto_planejamento',
        entityId: gastoCriado.id,
        event: 'PLANEJAMENTO_GASTO_CANCELADO',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
        userId: session.userId,
      }),
    );
    expect(logsCancelamento[0].details).toEqual({
      planejamentoId: planejamento.id,
      statusAnterior: GastoStatus.ATIVO,
      statusPosterior: GastoStatus.CANCELADO,
      valorCentavos: 4000,
      pagoPorParticipanteId: participanteProprietario?.id,
      participantesIds: [
        participanteProprietario?.id,
        participanteDevedor.id,
      ].sort(),
    });
    expect(JSON.stringify(logsCancelamento[0])).not.toContain(
      'Gasto a cancelar',
    );

    const acertosPersistidos = await acertoRepository.find({
      where: { planejamentoId: planejamento.id },
    });
    const pendentes = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );

    expect(pendentes).toEqual([
      expect.objectContaining({
        deParticipanteId: participanteProprietario?.id,
        paraParticipanteId: participanteDevedor.id,
        valorCentavos: 321,
      }),
    ]);
    expect(acertosPersistidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: acertoInicial?.id,
          status: AcertoStatus.PAGO,
          valorCentavos: 5000,
        }),
        expect.objectContaining({
          id: acertoHistoricoCancelado.id,
          observacao: acertoHistoricoCancelado.observacao,
          status: AcertoStatus.CANCELADO,
          valorCentavos: acertoHistoricoCancelado.valorCentavos,
        }),
        expect.objectContaining({
          id: acertoHistoricoConfirmado.id,
          observacao: acertoHistoricoConfirmado.observacao,
          status: AcertoStatus.CONFIRMADO,
          valorCentavos: acertoHistoricoConfirmado.valorCentavos,
        }),
      ]),
    );
  });

  it('rolls back expense status, divisions and reconciliation when cancellation audit fails', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.cancelar.gasto.rollback.e2e@example.com',
      nome: 'Rollback Cancelar Gasto E2E',
    });
    const authorization = `Bearer ${session.token}`;
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Rollback do cancelamento de gasto',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );
    expect(participanteProprietario).toBeDefined();

    const participanteResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization)
      .send({ nome: 'Participante do rollback' })
      .expect(201);
    const participante =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);
    const gastoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Gasto preservado no rollback',
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [participanteProprietario?.id, participante.id],
        valorCentavos: 10000,
      })
      .expect(201);
    const gasto = unwrapSuccess<GastoResponse>(gastoResponse);
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const projetarDivisoes = (divisoes: DivisaoGasto[]) =>
      [...divisoes]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((divisao) => ({
          id: divisao.id,
          participanteId: divisao.participanteId,
          status: divisao.status,
          valorDevidoCentavos: divisao.valorDevidoCentavos,
        }));
    const divisoesAntes = projetarDivisoes(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    );
    const acertosAntes = snapshotAcertos(
      await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    );
    await instalarFalhaAuditoriaCancelamento(gasto.id, session.userId);

    try {
      await request(app.getHttpServer())
        .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}/cancelar`)
        .set('Authorization', authorization)
        .expect(500);
    } finally {
      await removerTriggerAuditoria();
    }

    await expect(
      gastoRepository.findOneByOrFail({
        id: gasto.id,
        planejamentoId: planejamento.id,
      }),
    ).resolves.toEqual(expect.objectContaining({ status: GastoStatus.ATIVO }));
    expect(
      projetarDivisoes(
        await divisaoRepository.find({ where: { gastoId: gasto.id } }),
      ),
    ).toEqual(divisoesAntes);
    expect(
      snapshotAcertos(
        await acertoRepository.find({
          where: { planejamentoId: planejamento.id },
        }),
      ),
    ).toEqual(acertosAntes);
    await expect(
      dataSource.getRepository(AuditLog).countBy({
        entityId: gasto.id,
        event: 'PLANEJAMENTO_GASTO_CANCELADO',
      }),
    ).resolves.toBe(0);
  });
});
