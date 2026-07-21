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
  nome: string;
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  nome: string;
  participantes: ParticipanteResponse[];
  status: PlanejamentoStatus;
};

type GastoResponse = Identifiable & {
  descricao: string;
  status: GastoStatus;
  valorCentavos: number;
};

type AcertoResponse = Identifiable & {
  dataPagamento: string | null;
  devedorParticipanteId: string;
  recebedorParticipanteId: string;
  status: AcertoStatus;
  valorCentavos: number;
};

type CenarioComPendencia = {
  acerto: AcertoResponse;
  gasto: GastoResponse;
  participanteDevedor: ParticipanteResponse;
  participanteProprietario: ParticipanteResponse;
  planejamento: PlanejamentoResponse;
};

jest.setTimeout(60000);

describe('Planejamentos operational closing lifecycle (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let participanteVinculado: E2eAuthSession;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.fechar.owner.e2e@example.com',
      nome: 'Proprietario Fechamento E2E',
    });
    participanteVinculado = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.fechar.member.e2e@example.com',
      nome: 'Participante Fechamento E2E',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const authorization = () => `Bearer ${proprietario.token}`;

  async function buscarLogsFechamento(
    planejamentoId: string,
  ): Promise<AuditLog[]> {
    return dataSource.getRepository(AuditLog).find({
      where: {
        entity: 'planejamento',
        entityId: planejamentoId,
        event: 'PLANEJAMENTO_FECHADO',
      },
    });
  }

  function expectLogFechamento(logs: AuditLog[]): void {
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        action: 'update',
        entity: 'planejamento',
        event: 'PLANEJAMENTO_FECHADO',
        module: 'planejamentos',
        statusCode: 200,
        success: true,
        userId: proprietario.userId,
      }),
    );
    expect(logs[0].details).toEqual({
      statusAnterior: PlanejamentoStatus.ABERTO,
      statusPosterior: PlanejamentoStatus.FECHADO,
    });
  }

  async function criarCenarioComPendencia(
    sufixo: string,
  ): Promise<CenarioComPendencia> {
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: `Casa compartilhada - ${sufixo}`,
        tipo: PlanejamentoTipo.CASA,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === proprietario.userId,
    );

    expect(participanteProprietario).toBeDefined();

    const participanteResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization())
      .send({ nome: `Morador ${sufixo}` })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);
    const gastoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization())
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-06-30',
        descricao: `Aluguel ${sufixo}`,
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [
          participanteProprietario?.id,
          participanteDevedor.id,
        ],
        valorCentavos: 30000,
      })
      .expect(201);
    const gasto = unwrapSuccess<GastoResponse>(gastoResponse);
    const acertosResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization())
      .expect(200);
    const [acertoSugerido] = unwrapSuccess<AcertoResponse[]>(acertosResponse);

    expect(acertoSugerido).toEqual(
      expect.objectContaining({
        devedorParticipanteId: participanteDevedor.id,
        recebedorParticipanteId: participanteProprietario?.id,
        status: AcertoStatus.PENDENTE,
        valorCentavos: 15000,
      }),
    );
    const acertoPersistido = await dataSource
      .getRepository(AcertoPlanejamento)
      .findOneByOrFail({
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      });
    const acerto: AcertoResponse = {
      dataPagamento: null,
      devedorParticipanteId: acertoPersistido.deParticipanteId,
      id: acertoPersistido.id,
      recebedorParticipanteId: acertoPersistido.paraParticipanteId,
      status: acertoPersistido.status,
      valorCentavos: acertoPersistido.valorCentavos,
    };

    return {
      acerto,
      gasto,
      participanteDevedor,
      participanteProprietario: participanteProprietario!,
      planejamento,
    };
  }

  function expectDomainError(
    response: Response,
    code: string,
    statusAtual?: PlanejamentoStatus,
  ): void {
    expect(response.status).toBe(422);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code,
          ...(statusAtual
            ? { details: expect.objectContaining({ statusAtual }) as object }
            : {}),
        }) as object,
        success: false,
      }),
    );
  }

  it('closes with pending settlements, persists FECHADO and preserves the obligation without duplication', async () => {
    const { acerto, planejamento } = await criarCenarioComPendencia(
      'Junho 2026 - sucesso',
    );

    const fechamentoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<PlanejamentoResponse>(fechamentoResponse).status).toBe(
      PlanejamentoStatus.FECHADO,
    );

    const consultaResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<PlanejamentoResponse>(consultaResponse).status).toBe(
      PlanejamentoStatus.FECHADO,
    );

    const acertos = await dataSource.getRepository(AcertoPlanejamento).find({
      where: { planejamentoId: planejamento.id },
    });
    expect(acertos).toHaveLength(1);
    expect(acertos[0]).toEqual(
      expect.objectContaining({
        id: acerto.id,
        status: AcertoStatus.PENDENTE,
        valorCentavos: acerto.valorCentavos,
      }),
    );
    const logs = await buscarLogsFechamento(planejamento.id);
    expect(logs[0]).toEqual(
      expect.objectContaining({ entityId: planejamento.id }),
    );
    expectLogFechamento(logs);
  });

  it('rejects closing by an active participant who is not the owner', async () => {
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: 'Casa compartilhada - autorizacao',
        tipo: PlanejamentoTipo.CASA,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization())
      .send({
        nome: 'Participante vinculado',
        usuarioId: participanteVinculado.userId,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', `Bearer ${participanteVinculado.token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_OWNER_REQUIRED',
        }) as object,
        success: false,
      }),
    );
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.ABERTO }));
    await expect(buscarLogsFechamento(planejamento.id)).resolves.toHaveLength(
      0,
    );
  });

  it('rejects a second close and keeps the planning closed', async () => {
    const { planejamento } = await criarCenarioComPendencia(
      'Junho 2026 - segundo fechamento',
    );

    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
    const secondResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization());

    expectDomainError(
      secondResponse,
      'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      PlanejamentoStatus.FECHADO,
    );
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.FECHADO }));
  });

  it('rolls back closing when an expense is PENDENTE_REVISAO', async () => {
    const { gasto, planejamento } = await criarCenarioComPendencia(
      'Junho 2026 - revisao',
    );
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const acertosAntes = await acertoRepository.find({
      where: { planejamentoId: planejamento.id },
    });

    await dataSource.getRepository(GastoPlanejamento).update(gasto.id, {
      status: GastoStatus.PENDENTE_REVISAO,
    });

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization());

    expectDomainError(response, 'PLANEJAMENTO_FECHAR_GASTO_PENDENTE_REVISAO');
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.ABERTO }));
    expect(
      await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    ).toEqual(acertosAntes);
  });

  it('blocks all structural HTTP mutations after closing without changing aggregate data', async () => {
    const {
      gasto,
      participanteDevedor,
      participanteProprietario,
      planejamento,
    } = await criarCenarioComPendencia('Junho 2026 - estrutura');
    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);

    const planejamentoRepository = dataSource.getRepository(Planejamento);
    const participanteRepository = dataSource.getRepository(
      ParticipantePlanejamento,
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const snapshot = {
      acertos: await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
      divisoes: await divisaoRepository.find({
        where: { gastoId: gasto.id },
      }),
      gasto: await gastoRepository.findOneByOrFail({ id: gasto.id }),
      participantes: await participanteRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
      planejamento: await planejamentoRepository.findOneByOrFail({
        id: planejamento.id,
      }),
    };
    const requests = [
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/participantes`)
        .set('Authorization', authorization())
        .send({ nome: 'Participante bloqueado' }),
      request(app.getHttpServer())
        .delete(
          `/planejamentos/${planejamento.id}/participantes/${participanteDevedor.id}`,
        )
        .set('Authorization', authorization()),
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/gastos`)
        .set('Authorization', authorization())
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-01',
          descricao: 'Gasto bloqueado',
          pagoPorParticipanteId: participanteProprietario.id,
          participantesIds: [
            participanteProprietario.id,
            participanteDevedor.id,
          ],
          valorCentavos: 2000,
        }),
      request(app.getHttpServer())
        .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
        .set('Authorization', authorization())
        .send({ descricao: 'Descricao bloqueada' }),
      request(app.getHttpServer())
        .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}/cancelar`)
        .set('Authorization', authorization()),
    ];

    for (const response of await Promise.all(requests)) {
      expectDomainError(
        response,
        'PLANEJAMENTO_MUTACAO_ESTRUTURAL_STATUS_INVALIDO',
        PlanejamentoStatus.FECHADO,
      );
    }

    expect(
      await planejamentoRepository.findOneByOrFail({ id: planejamento.id }),
    ).toEqual(snapshot.planejamento);
    expect(
      await participanteRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    ).toEqual(snapshot.participantes);
    expect(await gastoRepository.findOneByOrFail({ id: gasto.id })).toEqual(
      snapshot.gasto,
    );
    expect(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    ).toEqual(snapshot.divisoes);
    expect(
      await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    ).toEqual(snapshot.acertos);
  });

  it('keeps synchronization, payment, cancellation and reopening available after closing', async () => {
    const { acerto, planejamento } = await criarCenarioComPendencia(
      'Junho 2026 - acertos',
    );
    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);

    const sincronizacaoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/acertos/sincronizar`)
      .set('Authorization', authorization())
      .expect(201);
    expect(unwrapSuccess<AcertoResponse[]>(sincronizacaoResponse)).toEqual([
      expect.objectContaining({ id: acerto.id, status: AcertoStatus.PENDENTE }),
    ]);

    const pagamentoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/acertos/${acerto.id}/pagar`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(pagamentoResponse)).toEqual(
      expect.objectContaining({
        dataPagamento: expect.any(String) as string,
        id: acerto.id,
        status: AcertoStatus.PAGO,
      }),
    );

    const cancelamentoResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/acertos/${acerto.id}/cancelar`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(cancelamentoResponse)).toEqual(
      expect.objectContaining({
        dataPagamento: null,
        id: acerto.id,
        status: AcertoStatus.CANCELADO,
      }),
    );

    const reaberturaResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/acertos/${acerto.id}/reabrir`)
      .set('Authorization', authorization())
      .expect(200);
    expect(unwrapSuccess<AcertoResponse>(reaberturaResponse)).toEqual(
      expect.objectContaining({ id: acerto.id, status: AcertoStatus.PENDENTE }),
    );
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.FECHADO }));
  });

  it('serializes two concurrent close requests without duplicating pending settlements', async () => {
    const { acerto, planejamento } = await criarCenarioComPendencia(
      'Junho 2026 - concorrencia',
    );
    const endpoint = `/planejamentos/${planejamento.id}/fechar`;

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
    const invalidResponse = responses.find(
      (response) => response.status === 422,
    );
    expectDomainError(
      invalidResponse!,
      'PLANEJAMENTO_FECHAR_STATUS_INVALIDO',
      PlanejamentoStatus.FECHADO,
    );
    expect(
      await dataSource.getRepository(Planejamento).findOneByOrFail({
        id: planejamento.id,
      }),
    ).toEqual(expect.objectContaining({ status: PlanejamentoStatus.FECHADO }));
    expect(
      await dataSource.getRepository(AcertoPlanejamento).find({
        where: { planejamentoId: planejamento.id },
      }),
    ).toEqual([
      expect.objectContaining({
        id: acerto.id,
        status: AcertoStatus.PENDENTE,
      }),
    ]);
    expectLogFechamento(await buscarLogsFechamento(planejamento.id));
  });
});
