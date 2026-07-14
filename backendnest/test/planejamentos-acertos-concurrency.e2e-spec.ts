import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
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
