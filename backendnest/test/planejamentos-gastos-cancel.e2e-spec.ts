import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
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

jest.setTimeout(60000);

describe('Planejamentos expense cancellation (e2e)', () => {
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
});
