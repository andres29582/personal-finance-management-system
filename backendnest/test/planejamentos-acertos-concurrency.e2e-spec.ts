import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AuditLog } from '../src/logs/entities/audit-log.entity';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import { Planejamento } from '../src/planejamentos/entities/planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
  ParticipanteStatus,
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

type AcertoResponse = Identifiable & {
  deParticipanteId: string;
  paraParticipanteId: string;
  status: AcertoStatus;
  valorCentavos: number;
};

jest.setTimeout(60000);

describe('Planejamentos settlement synchronization concurrency (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function criarCenarioComAcertoPendente(dadosUsuario: {
    cpf: string;
    email: string;
    nome: string;
  }) {
    const session = await registerAndLoginTestUser(app, dadosUsuario);
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        nome: `Viagem concorrente de ${dadosUsuario.nome}`,
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
      .set('Authorization', `Bearer ${session.token}`)
      .send({ nome: 'Participante devedor' })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-13',
        descricao: 'Hospedagem compartilhada',
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [
          participanteProprietario?.id,
          participanteDevedor.id,
        ],
        valorCentavos: 10000,
      })
      .expect(201);

    const sincronizacaoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/acertos/sincronizar`)
      .set('Authorization', `Bearer ${session.token}`)
      .expect(201);
    const [acertoPendente] = unwrapSuccess<AcertoResponse[]>(
      sincronizacaoResponse,
    );

    expect(acertoPendente).toEqual(
      expect.objectContaining({
        deParticipanteId: participanteDevedor.id,
        paraParticipanteId: participanteProprietario?.id,
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    );

    return { acertoPendente, planejamento, session };
  }

  async function buscarLogsReabertura(acertoId: string): Promise<AuditLog[]> {
    return dataSource.getRepository(AuditLog).find({
      where: {
        entity: 'acerto_planejamento',
        entityId: acertoId,
        event: 'ACERTO_PLANEJAMENTO_REABERTO',
      },
    });
  }

  it('serializes concurrent synchronizations for the same planejamento', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.concorrencia.e2e@example.com',
      nome: 'Planejamento Concorrencia E2E',
    });
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        nome: 'Viagem concorrente',
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
      .set('Authorization', `Bearer ${session.token}`)
      .send({ nome: 'Participante devedor' })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-13',
        descricao: 'Hospedagem compartilhada',
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [
          participanteProprietario?.id,
          participanteDevedor.id,
        ],
        valorCentavos: 10000,
      })
      .expect(201);

    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const acertoHistorico = Object.assign(new AcertoPlanejamento(), {
      id: randomUUID(),
      planejamentoId: planejamento.id,
      deParticipanteId: participanteProprietario?.id,
      paraParticipanteId: participanteDevedor.id,
      valorCentavos: 1234,
      status: AcertoStatus.CANCELADO,
      dataPagamento: null,
      observacao: 'Historico anterior a sincronizacao concorrente',
    });
    await acertoRepository.save(acertoHistorico);

    const endpoint = `/planejamentos/${planejamento.id}/acertos/sincronizar`;
    const [primeiraResposta, segundaResposta] = await Promise.all([
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', `Bearer ${session.token}`)
        .expect(201),
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', `Bearer ${session.token}`)
        .expect(201),
    ]);
    const primeiroResultado = unwrapSuccess<AcertoResponse[]>(primeiraResposta);
    const segundoResultado = unwrapSuccess<AcertoResponse[]>(segundaResposta);
    const normalizar = (acertos: AcertoResponse[]) =>
      acertos.map((acerto) => ({
        id: acerto.id,
        deParticipanteId: acerto.deParticipanteId,
        paraParticipanteId: acerto.paraParticipanteId,
        status: acerto.status,
        valorCentavos: acerto.valorCentavos,
      }));

    expect(normalizar(primeiroResultado)).toEqual(normalizar(segundoResultado));
    expect(primeiroResultado).toHaveLength(1);
    expect(primeiroResultado[0]).toEqual(
      expect.objectContaining({
        deParticipanteId: participanteDevedor.id,
        paraParticipanteId: participanteProprietario?.id,
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    );

    const acertosPersistidos = await acertoRepository.find({
      where: { planejamentoId: planejamento.id },
    });
    const pendentes = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]).toEqual(
      expect.objectContaining({
        deParticipanteId: participanteDevedor.id,
        paraParticipanteId: participanteProprietario?.id,
        valorCentavos: 5000,
      }),
    );
    expect(acertosPersistidos).toHaveLength(2);
    expect(acertosPersistidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: acertoHistorico.id,
          status: AcertoStatus.CANCELADO,
        }),
      ]),
    );
  });

  it('serializes settlement synchronization with payment', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '39053344705',
        email: 'planejamento.sincronizar-pagar.e2e@example.com',
        nome: 'Sincronizar Pagar E2E',
      });
    const authorization = `Bearer ${session.token}`;

    const [sincronizacaoResponse, pagamentoResponse] = await Promise.all([
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/acertos/sincronizar`)
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/pagar`,
        )
        .set('Authorization', authorization),
    ]);

    expect(sincronizacaoResponse.status).toBe(201);
    expect(pagamentoResponse.status).toBe(200);
    expect(unwrapSuccess<AcertoResponse>(pagamentoResponse)).toEqual(
      expect.objectContaining({
        id: acertoPendente.id,
        status: AcertoStatus.PAGO,
      }),
    );

    const acertosPersistidos = await dataSource
      .getRepository(AcertoPlanejamento)
      .find({ where: { planejamentoId: planejamento.id } });
    const pendentes = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );
    const pagos = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PAGO,
    );

    expect(pendentes).toHaveLength(0);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.id).toBe(acertoPendente.id);
    expect(acertosPersistidos).toHaveLength(1);
  });

  it('serializes reopening a paid settlement with synchronization without changing its id', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '93541134780',
        email: 'planejamento.reabrir-sincronizar.e2e@example.com',
        nome: 'Reabrir Sincronizar E2E',
      });
    const authorization = `Bearer ${session.token}`;

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/pagar`,
      )
      .set('Authorization', authorization)
      .expect(200);

    const [reaberturaResponse, sincronizacaoResponse] = await Promise.all([
      request(app.getHttpServer())
        .patch(
          `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/reabrir`,
        )
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/acertos/sincronizar`)
        .set('Authorization', authorization),
    ]);

    expect(reaberturaResponse.status).toBe(200);
    expect(sincronizacaoResponse.status).toBe(201);
    expect(unwrapSuccess<AcertoResponse>(reaberturaResponse)).toEqual(
      expect.objectContaining({
        id: acertoPendente.id,
        status: AcertoStatus.PENDENTE,
      }),
    );
    const leituraResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization)
      .expect(200);
    expect(unwrapSuccess<AcertoResponse[]>(leituraResponse)).toEqual([
      expect.objectContaining({
        id: acertoPendente.id,
        status: AcertoStatus.PENDENTE,
      }),
    ]);
    await expect(buscarLogsReabertura(acertoPendente.id)).resolves.toHaveLength(
      1,
    );
  });

  it('serializes concurrent payment and reopening without duplicating the obligation', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '24681357928',
        email: 'planejamento.pagar-reabrir.e2e@example.com',
        nome: 'Pagar Reabrir E2E',
      });
    const authorization = `Bearer ${session.token}`;
    const endpointBase = `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}`;

    const [pagamentoResponse, reaberturaResponse] = await Promise.all([
      request(app.getHttpServer())
        .patch(`${endpointBase}/pagar`)
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .patch(`${endpointBase}/reabrir`)
        .set('Authorization', authorization),
    ]);

    expect(pagamentoResponse.status).toBe(200);
    expect([200, 422]).toContain(reaberturaResponse.status);
    if (reaberturaResponse.status === 422) {
      expect(reaberturaResponse.body).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO',
          }) as object,
          success: false,
        }),
      );
    }

    const leituraResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization)
      .expect(200);
    const acertos = unwrapSuccess<AcertoResponse[]>(leituraResponse);

    expect(acertos).toHaveLength(1);
    expect(acertos[0]).toEqual(
      expect.objectContaining({
        id: acertoPendente.id,
        status:
          reaberturaResponse.status === 200
            ? AcertoStatus.PENDENTE
            : AcertoStatus.PAGO,
      }),
    );
    await expect(buscarLogsReabertura(acertoPendente.id)).resolves.toHaveLength(
      reaberturaResponse.status === 200 ? 1 : 0,
    );
  });

  it('allows exactly one of two concurrent reopenings and records one audit event', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '16899535009',
        email: 'planejamento.reabrir-duplo.e2e@example.com',
        nome: 'Reabrir Duplo E2E',
      });
    const authorization = `Bearer ${session.token}`;
    const endpoint = `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/reabrir`;

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/pagar`,
      )
      .set('Authorization', authorization)
      .expect(200);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([200, 422]);
    const failure = responses.find((response) => response.status === 422);
    expect(failure?.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO',
        }) as object,
        success: false,
      }),
    );

    const leituraResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization)
      .expect(200);
    expect(unwrapSuccess<AcertoResponse[]>(leituraResponse)).toEqual([
      expect.objectContaining({
        id: acertoPendente.id,
        status: AcertoStatus.PENDENTE,
      }),
    ]);
    await expect(buscarLogsReabertura(acertoPendente.id)).resolves.toHaveLength(
      1,
    );
  });

  it('rejects a reopening retry without changing state or duplicating audit', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '98765432100',
        email: 'planejamento.reabrir-retry.e2e@example.com',
        nome: 'Reabrir Retry E2E',
      });
    const authorization = `Bearer ${session.token}`;
    const endpoint = `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/reabrir`;

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/pagar`,
      )
      .set('Authorization', authorization)
      .expect(200);
    await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', authorization)
      .expect(200);

    const retryResponse = await request(app.getHttpServer())
      .patch(endpoint)
      .set('Authorization', authorization)
      .expect(422);
    expect(retryResponse.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_ACERTO_REABRIR_STATUS_INVALIDO',
        }) as object,
        success: false,
      }),
    );

    const leituraResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', authorization)
      .expect(200);
    expect(unwrapSuccess<AcertoResponse[]>(leituraResponse)).toEqual([
      expect.objectContaining({
        id: acertoPendente.id,
        status: AcertoStatus.PENDENTE,
      }),
    ]);
    await expect(buscarLogsReabertura(acertoPendente.id)).resolves.toHaveLength(
      1,
    );
  });

  it('allows only one of two concurrent payments to transition the settlement', async () => {
    const { acertoPendente, planejamento, session } =
      await criarCenarioComAcertoPendente({
        cpf: '68199965000',
        email: 'planejamento.pagar-pagar.e2e@example.com',
        nome: 'Pagar Pagar E2E',
      });
    const endpoint = `/planejamentos/${planejamento.id}/acertos/${acertoPendente.id}/pagar`;
    const authorization = `Bearer ${session.token}`;

    const respostas = await Promise.all([
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization),
      request(app.getHttpServer())
        .patch(endpoint)
        .set('Authorization', authorization),
    ]);

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([
      200, 422,
    ]);
    const respostaInvalida = respostas.find(
      (resposta) => resposta.status === 422,
    );
    expect(respostaInvalida?.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_ACERTO_PAGAR_STATUS_INVALIDO',
        }) as object,
        success: false,
      }),
    );

    const acertosPersistidos = await dataSource
      .getRepository(AcertoPlanejamento)
      .find({ where: { planejamentoId: planejamento.id } });
    const pendentes = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );
    const pagos = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PAGO,
    );

    expect(pendentes).toHaveLength(0);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.id).toBe(acertoPendente.id);
    expect(acertosPersistidos).toHaveLength(1);
  });

  it('serializes expense creation with explicit settlement synchronization', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'planejamento.criar-gasto-sincronizar.e2e@example.com',
      nome: 'Criar Gasto Sincronizar E2E',
    });
    const authorization = `Bearer ${session.token}`;
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Viagem com mutacao concorrente',
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
      .send({ nome: 'Participante devedor concorrente' })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-13',
        descricao: 'Hospedagem inicial',
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [
          participanteProprietario?.id,
          participanteDevedor.id,
        ],
        valorCentavos: 10000,
      })
      .expect(201);

    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const acertoInicial = await acertoRepository.findOneByOrFail({
      planejamentoId: planejamento.id,
      status: AcertoStatus.PENDENTE,
    });

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${planejamento.id}/acertos/${acertoInicial.id}/pagar`,
      )
      .set('Authorization', authorization)
      .expect(200);

    const acertoCancelado = await acertoRepository.save(
      Object.assign(new AcertoPlanejamento(), {
        id: randomUUID(),
        planejamentoId: planejamento.id,
        deParticipanteId: participanteProprietario?.id,
        paraParticipanteId: participanteDevedor.id,
        valorCentavos: 1234,
        status: AcertoStatus.CANCELADO,
        dataPagamento: null,
        observacao: 'Historico cancelado preservado',
      }),
    );

    const [criacaoResponse, sincronizacaoResponse] = await Promise.all([
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/gastos`)
        .set('Authorization', authorization)
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-14',
          descricao: 'Almoco concorrente',
          pagoPorParticipanteId: participanteProprietario?.id,
          participantesIds: [
            participanteProprietario?.id,
            participanteDevedor.id,
          ],
          valorCentavos: 4000,
        }),
      request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/acertos/sincronizar`)
        .set('Authorization', authorization),
    ]);

    expect(criacaoResponse.status).toBe(201);
    expect(sincronizacaoResponse.status).toBe(201);

    const gastoPersistido = await dataSource
      .getRepository(GastoPlanejamento)
      .findOne({
        where: {
          descricao: 'Almoco concorrente',
          planejamentoId: planejamento.id,
        },
        relations: { divisoes: true },
      });

    expect(gastoPersistido).toEqual(
      expect.objectContaining({
        valorCentavos: 4000,
      }),
    );
    expect(gastoPersistido?.divisoes).toHaveLength(2);
    expect(
      gastoPersistido?.divisoes.reduce(
        (total, divisao) => total + divisao.valorDevidoCentavos,
        0,
      ),
    ).toBe(4000);

    const acertosPersistidos = await acertoRepository.find({
      where: { planejamentoId: planejamento.id },
    });
    const pendentes = acertosPersistidos.filter(
      (acerto) => acerto.status === AcertoStatus.PENDENTE,
    );

    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]).toEqual(
      expect.objectContaining({
        deParticipanteId: participanteDevedor.id,
        paraParticipanteId: participanteProprietario?.id,
        valorCentavos: 2000,
      }),
    );
    expect(acertosPersistidos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: acertoInicial.id,
          status: AcertoStatus.PAGO,
        }),
        expect.objectContaining({
          id: acertoCancelado.id,
          status: AcertoStatus.CANCELADO,
        }),
      ]),
    );
  });

  it('preserves a removed participant financial obligation without accepting it in a new expense', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '12345678909',
      email: 'planejamento.participante-historico.e2e@example.com',
      nome: 'Participante Historico E2E',
    });
    const authorization = `Bearer ${session.token}`;
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Viagem com participante historico',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );

    expect(participanteProprietario).toBeDefined();

    try {
      const participanteResponse = await request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/participantes`)
        .set('Authorization', authorization)
        .send({ nome: 'Participante removido' })
        .expect(201);
      const participanteRemovido =
        unwrapSuccess<ParticipanteResponse>(participanteResponse);

      await request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/gastos`)
        .set('Authorization', authorization)
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-14',
          descricao: 'Hospedagem com participante historico',
          pagoPorParticipanteId: participanteProprietario?.id,
          participantesIds: [
            participanteProprietario?.id,
            participanteRemovido.id,
          ],
          valorCentavos: 10000,
        })
        .expect(201);

      await dataSource
        .getRepository(ParticipantePlanejamento)
        .update(participanteRemovido.id, {
          status: ParticipanteStatus.REMOVIDO,
        });

      const acertosResponse = await request(app.getHttpServer())
        .get(`/planejamentos/${planejamento.id}/acertos`)
        .set('Authorization', authorization)
        .expect(200);
      const acertos = unwrapSuccess<AcertoResponse[]>(acertosResponse);

      expect(acertos).toEqual([
        expect.objectContaining({
          deParticipanteId: participanteRemovido.id,
          id: expect.any(String) as string,
          paraParticipanteId: participanteProprietario?.id,
          status: AcertoStatus.PENDENTE,
          valorCentavos: 5000,
        }),
      ]);

      const novoGastoResponse = await request(app.getHttpServer())
        .post(`/planejamentos/${planejamento.id}/gastos`)
        .set('Authorization', authorization)
        .send({
          comportamento: GastoComportamento.EVENTUAL,
          dataGasto: '2026-07-14',
          descricao: 'Novo gasto invalido',
          pagoPorParticipanteId: participanteRemovido.id,
          participantesIds: [participanteProprietario?.id],
          valorCentavos: 2000,
        });

      expect(novoGastoResponse.status).toBe(422);
      expect(novoGastoResponse.body).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'PLANEJAMENTO_PAGADOR_INVALIDO',
          }) as object,
          success: false,
        }),
      );
    } finally {
      const gastos = await dataSource.getRepository(GastoPlanejamento).find({
        select: { id: true },
        where: { planejamentoId: planejamento.id },
      });
      const gastosIds = gastos.map((gasto) => gasto.id);

      await dataSource
        .getRepository(AcertoPlanejamento)
        .delete({ planejamentoId: planejamento.id });
      if (gastosIds.length > 0) {
        await dataSource
          .getRepository(DivisaoGasto)
          .delete({ gastoId: In(gastosIds) });
      }
      await dataSource
        .getRepository(GastoPlanejamento)
        .delete({ planejamentoId: planejamento.id });
      await dataSource
        .getRepository(ParticipantePlanejamento)
        .delete({ planejamentoId: planejamento.id });
      await dataSource
        .getRepository(Planejamento)
        .delete({ id: planejamento.id });
    }
  });

  it('rolls back expense and splits when settlement reconciliation fails', async () => {
    const session = await registerAndLoginTestUser(app, {
      cpf: '10000001090',
      email: 'planejamento.rollback-gasto.e2e@example.com',
      nome: 'Rollback Gasto E2E',
    });
    const authorization = `Bearer ${session.token}`;
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Viagem com rollback',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamento =
      unwrapSuccess<PlanejamentoResponse>(planejamentoResponse);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );

    expect(participanteProprietario).toBeDefined();

    const participanteAtivoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization)
      .send({ nome: 'Participante ativo' })
      .expect(201);
    const participanteAtivo = unwrapSuccess<ParticipanteResponse>(
      participanteAtivoResponse,
    );
    const participanteRemovidoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/participantes`)
      .set('Authorization', authorization)
      .send({ nome: 'Participante removido' })
      .expect(201);
    const participanteRemovido = unwrapSuccess<ParticipanteResponse>(
      participanteRemovidoResponse,
    );
    const participanteRepository = dataSource.getRepository(
      ParticipantePlanejamento,
    );
    await participanteRepository.update(participanteRemovido.id, {
      status: ParticipanteStatus.REMOVIDO,
    });

    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const acertoHistoricoPago = await acertoRepository.save(
      Object.assign(new AcertoPlanejamento(), {
        id: randomUUID(),
        planejamentoId: planejamento.id,
        deParticipanteId: participanteRemovido.id,
        paraParticipanteId: participanteProprietario?.id,
        valorCentavos: 100,
        status: AcertoStatus.PAGO,
        dataPagamento: new Date('2026-07-14T12:00:00.000Z'),
        observacao: 'Estado historico invalido para forcar rollback',
      }),
    );

    // A referencia fora do agregado preserva a falha de integridade que
    // exercita o rollback sem tratar participante removido historico como erro.
    const planejamentoExternoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization)
      .send({
        nome: 'Planejamento externo para inconsistencia',
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);
    const planejamentoExterno = unwrapSuccess<PlanejamentoResponse>(
      planejamentoExternoResponse,
    );
    await participanteRepository.update(participanteRemovido.id, {
      planejamentoId: planejamentoExterno.id,
    });

    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const contarDivisoesDoPlanejamento = () =>
      divisaoRepository
        .createQueryBuilder('divisao')
        .innerJoin('divisao.gasto', 'gasto')
        .where('gasto.planejamentoId = :planejamentoId', {
          planejamentoId: planejamento.id,
        })
        .getCount();
    const gastosAntes = await gastoRepository.count({
      where: { planejamentoId: planejamento.id },
    });
    const divisoesAntes = await contarDivisoesDoPlanejamento();

    const resposta = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Gasto que deve sofrer rollback',
        pagoPorParticipanteId: participanteProprietario?.id,
        participantesIds: [participanteProprietario?.id, participanteAtivo.id],
        valorCentavos: 2000,
      });

    expect(resposta.status).toBe(422);
    expect(resposta.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PARTICIPANTE_INVALIDO',
        }) as object,
        success: false,
      }),
    );
    expect(
      await gastoRepository.count({
        where: { planejamentoId: planejamento.id },
      }),
    ).toBe(gastosAntes);
    expect(await contarDivisoesDoPlanejamento()).toBe(divisoesAntes);
    expect(
      await gastoRepository.findOneBy({
        descricao: 'Gasto que deve sofrer rollback',
        planejamentoId: planejamento.id,
      }),
    ).toBeNull();
    expect(
      await acertoRepository.findOneByOrFail({ id: acertoHistoricoPago.id }),
    ).toEqual(
      expect.objectContaining({
        dataPagamento: acertoHistoricoPago.dataPagamento,
        deParticipanteId: acertoHistoricoPago.deParticipanteId,
        id: acertoHistoricoPago.id,
        observacao: acertoHistoricoPago.observacao,
        paraParticipanteId: acertoHistoricoPago.paraParticipanteId,
        planejamentoId: acertoHistoricoPago.planejamentoId,
        status: AcertoStatus.PAGO,
        updatedAt: acertoHistoricoPago.updatedAt,
        valorCentavos: acertoHistoricoPago.valorCentavos,
      }),
    );
  });
});
