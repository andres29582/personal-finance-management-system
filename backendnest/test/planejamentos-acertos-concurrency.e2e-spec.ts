import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
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
});
