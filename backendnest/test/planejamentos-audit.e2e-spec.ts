import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import { Planejamento } from '../src/planejamentos/entities/planejamento.entity';
import {
  ParticipanteStatus,
  ParticipanteTipo,
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
  status: ParticipanteStatus;
  tipo: ParticipanteTipo;
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
  status: PlanejamentoStatus;
  tipo: PlanejamentoTipo;
};

type AuditFailureTrigger = {
  functionName: string;
  triggerName: string;
};

jest.setTimeout(60000);

describe('Planejamentos creation audit (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let proprietarioRollback: E2eAuthSession;
  let auditFailureTrigger: AuditFailureTrigger | null = null;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.audit.owner.e2e@example.com',
      nome: 'Proprietario Auditoria E2E',
    });
    proprietarioRollback = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.audit.rollback.e2e@example.com',
      nome: 'Proprietario Rollback Auditoria E2E',
    });
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

  afterAll(async () => {
    await app?.close();
  });

  const authorization = (session: E2eAuthSession) => `Bearer ${session.token}`;

  it('persists the planejamento, owner participant and one creation audit event', async () => {
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization(proprietario))
      .send({
        descricao: 'Descricao que nao deve ser registrada no audit log',
        nome: 'Planejamento auditado',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento = unwrapSuccess<PlanejamentoResponse>(response);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === proprietario.userId,
    );

    expect(participanteProprietario).toBeDefined();
    await expect(
      dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: PlanejamentoStatus.ABERTO,
        tipo: PlanejamentoTipo.VIAGEM,
        usuarioCriadorId: proprietario.userId,
      }),
    );

    const participantes = await dataSource
      .getRepository(ParticipantePlanejamento)
      .find({ where: { planejamentoId: planejamento.id } });
    expect(participantes).toEqual([
      expect.objectContaining({
        id: participanteProprietario!.id,
        planejamentoId: planejamento.id,
        status: ParticipanteStatus.ATIVO,
        tipo: ParticipanteTipo.VINCULADO,
        usuarioId: proprietario.userId,
      }),
    ]);

    const logs = await dataSource.getRepository(AuditLog).find({
      where: {
        event: 'PLANEJAMENTO_CRIADO',
        userId: proprietario.userId,
      },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: 'create',
        entity: 'planejamento',
        entityId: planejamento.id,
        event: 'PLANEJAMENTO_CRIADO',
        module: 'planejamentos',
        statusCode: 201,
        success: true,
        userId: proprietario.userId,
      }),
    );
    expect(logs[0].details).toEqual({
      statusPosterior: PlanejamentoStatus.ABERTO,
      tipo: PlanejamentoTipo.VIAGEM,
      participanteProprietarioId: participanteProprietario!.id,
    });
    const logSerializado = JSON.stringify(logs[0]);
    expect(logSerializado).not.toContain('Planejamento auditado');
    expect(logSerializado).not.toContain(
      'Descricao que nao deve ser registrada no audit log',
    );
    expect(logSerializado).not.toContain(proprietario.email);
  });

  it('rolls back the planejamento and owner participant when creation audit persistence fails', async () => {
    const planejamentoRepository = dataSource.getRepository(Planejamento);
    const participanteRepository = dataSource.getRepository(
      ParticipantePlanejamento,
    );
    const planejamentosAntes = await planejamentoRepository.count();
    const participantesAntes = await participanteRepository.count();
    const triggerSuffix = randomUUID().replace(/-/g, '_');
    auditFailureTrigger = {
      functionName: `falhar_auditoria_criacao_${triggerSuffix}`,
      triggerName: `trigger_falhar_auditoria_criacao_${triggerSuffix}`,
    };
    const { functionName, triggerName } = auditFailureTrigger;

    try {
      await dataSource.query(`
        CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
        BEGIN
          IF NEW.entity = 'planejamento'
            AND NEW.event = 'PLANEJAMENTO_CRIADO'
            AND NEW.user_id = '${proprietarioRollback.userId}' THEN
            RAISE EXCEPTION 'falha de auditoria induzida pelo teste';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER ${triggerName}
        BEFORE INSERT ON audit_log
        FOR EACH ROW EXECUTE FUNCTION ${functionName}();
      `);

      await request(app.getHttpServer())
        .post('/planejamentos')
        .set('Authorization', authorization(proprietarioRollback))
        .send({
          nome: 'Planejamento revertido pela auditoria',
          tipo: PlanejamentoTipo.CASA,
        })
        .expect(500);
    } finally {
      await removerTriggerAuditoria();
    }

    await expect(planejamentoRepository.count()).resolves.toBe(
      planejamentosAntes,
    );
    await expect(participanteRepository.count()).resolves.toBe(
      participantesAntes,
    );
    await expect(
      planejamentoRepository.countBy({
        usuarioCriadorId: proprietarioRollback.userId,
      }),
    ).resolves.toBe(0);
    await expect(
      participanteRepository.countBy({
        usuarioId: proprietarioRollback.userId,
      }),
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(AuditLog).countBy({
        event: 'PLANEJAMENTO_CRIADO',
        userId: proprietarioRollback.userId,
      }),
    ).resolves.toBe(0);
  });
});
