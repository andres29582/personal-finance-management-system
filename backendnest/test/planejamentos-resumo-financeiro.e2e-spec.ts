import request from 'supertest';
import { DataSource } from 'typeorm';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import { Planejamento } from '../src/planejamentos/entities/planejamento.entity';
import {
  AcertoStatus,
  GastoComportamento,
  GastoStatus,
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
  nome: string;
  status: ParticipanteStatus;
  tipo: ParticipanteTipo;
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
  status: PlanejamentoStatus;
};

type GastoResponse = Identifiable & {
  status: GastoStatus;
};

type ResumoResponse = {
  planejamentoId: string;
  statusOperacional: PlanejamentoStatus;
  situacaoFinanceira: 'PENDENTE' | 'QUITADO';
  totalGastosAtivosCentavos: number;
  obrigacaoResidualCentavos: number;
  participantes: Array<{
    participante: Pick<ParticipanteResponse, 'id' | 'nome' | 'status' | 'tipo'>;
    totalPagoCentavos: number;
    totalDevidoCentavos: number;
    totalPagoEmAcertosCentavos: number;
    totalRecebidoEmAcertosCentavos: number;
    saldoBrutoCentavos: number;
    saldoAbertoCentavos: number;
    statusFinanceiro: 'DEVEDOR' | 'RECEBEDOR' | 'QUITADO';
  }>;
};

type CenarioFinanceiro = {
  planejamento: PlanejamentoResponse;
  participanteProprietario: ParticipanteResponse;
  participanteDevedor: ParticipanteResponse;
  gasto: GastoResponse;
  acerto: AcertoPlanejamento;
};

jest.setTimeout(60000);

describe('Planejamentos financial summary (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let usuarioSemAcesso: E2eAuthSession;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamento.resumo.owner.e2e@example.com',
      nome: 'Proprietario Resumo E2E',
    });
    usuarioSemAcesso = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamento.resumo.outsider.e2e@example.com',
      nome: 'Usuario Sem Acesso Resumo E2E',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const authorization = () => `Bearer ${proprietario.token}`;

  async function criarCenarioFinanceiro(
    sufixo: string,
    valorCentavos = 10001,
  ): Promise<CenarioFinanceiro> {
    const planejamentoResponse = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', authorization())
      .send({
        nome: `Resumo financeiro ${sufixo}`,
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
      .send({ nome: `Participante ${sufixo}` })
      .expect(201);
    const participanteDevedor =
      unwrapSuccess<ParticipanteResponse>(participanteResponse);
    const gastoResponse = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', authorization())
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-15',
        descricao: `Gasto ${sufixo}`,
        pagoPorParticipanteId: participanteProprietario!.id,
        participantesIds: [
          participanteProprietario!.id,
          participanteDevedor.id,
        ],
        valorCentavos,
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

  async function snapshotAgregado(planejamentoId: string) {
    const gastos = await dataSource.getRepository(GastoPlanejamento).find({
      where: { planejamentoId },
      order: { id: 'ASC' },
    });

    return {
      planejamento: await dataSource
        .getRepository(Planejamento)
        .findOneByOrFail({ id: planejamentoId }),
      participantes: await dataSource
        .getRepository(ParticipantePlanejamento)
        .find({ where: { planejamentoId }, order: { id: 'ASC' } }),
      gastos,
      divisoes: await dataSource.getRepository(DivisaoGasto).find({
        where: gastos.map((gasto) => ({ gastoId: gasto.id })),
        order: { id: 'ASC' },
      }),
      acertos: await dataSource.getRepository(AcertoPlanejamento).find({
        where: { planejamentoId },
        order: { id: 'ASC' },
      }),
    };
  }

  it('derives ABERTO/FECHADO summaries, settles them and never mutates data on GET', async () => {
    const {
      planejamento,
      participanteProprietario,
      participanteDevedor,
      acerto,
    } = await criarCenarioFinanceiro('ciclo completo');
    const endpoint = `/planejamentos/${planejamento.id}/resumo`;
    const snapshotAntes = await snapshotAgregado(planejamento.id);

    const primeiraConsulta = unwrapSuccess<ResumoResponse>(
      await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', authorization())
        .expect(200),
    );

    expect(primeiraConsulta).toEqual({
      planejamentoId: planejamento.id,
      statusOperacional: PlanejamentoStatus.ABERTO,
      situacaoFinanceira: 'PENDENTE',
      totalGastosAtivosCentavos: 10001,
      obrigacaoResidualCentavos: 5000,
      participantes: [
        {
          participante: {
            id: participanteProprietario.id,
            nome: participanteProprietario.nome,
            tipo: participanteProprietario.tipo,
            status: participanteProprietario.status,
          },
          totalPagoCentavos: 10001,
          totalDevidoCentavos: 5001,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: 5000,
          saldoAbertoCentavos: 5000,
          statusFinanceiro: 'RECEBEDOR',
        },
        {
          participante: {
            id: participanteDevedor.id,
            nome: participanteDevedor.nome,
            tipo: participanteDevedor.tipo,
            status: participanteDevedor.status,
          },
          totalPagoCentavos: 0,
          totalDevidoCentavos: 5000,
          totalPagoEmAcertosCentavos: 0,
          totalRecebidoEmAcertosCentavos: 0,
          saldoBrutoCentavos: -5000,
          saldoAbertoCentavos: -5000,
          statusFinanceiro: 'DEVEDOR',
        },
      ],
    });
    expect(
      primeiraConsulta.participantes.reduce(
        (total, participante) =>
          total + Math.abs(participante.saldoAbertoCentavos),
        0,
      ),
    ).toBe(10000);
    expect(primeiraConsulta.obrigacaoResidualCentavos).toBe(5000);

    await request(app.getHttpServer())
      .get(endpoint)
      .set('Authorization', authorization())
      .expect(200);
    expect(await snapshotAgregado(planejamento.id)).toEqual(snapshotAntes);

    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/fechar`)
      .set('Authorization', authorization())
      .expect(200);
    const resumoFechadoPendente = unwrapSuccess<ResumoResponse>(
      await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', authorization())
        .expect(200),
    );

    expect(resumoFechadoPendente).toEqual(
      expect.objectContaining({
        statusOperacional: PlanejamentoStatus.FECHADO,
        situacaoFinanceira: 'PENDENTE',
        obrigacaoResidualCentavos: 5000,
      }),
    );

    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/acertos/${acerto.id}/pagar`)
      .set('Authorization', authorization())
      .expect(200);
    const resumoFechadoQuitado = unwrapSuccess<ResumoResponse>(
      await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', authorization())
        .expect(200),
    );

    expect(resumoFechadoQuitado).toEqual(
      expect.objectContaining({
        statusOperacional: PlanejamentoStatus.FECHADO,
        situacaoFinanceira: 'QUITADO',
        obrigacaoResidualCentavos: 0,
      }),
    );
    expect(
      resumoFechadoQuitado.participantes.every(
        (participante) =>
          participante.saldoAbertoCentavos === 0 &&
          participante.statusFinanceiro === 'QUITADO',
      ),
    ).toBe(true);
  });

  it('excludes canceled and pending-review expenses from the official summary', async () => {
    const cenarioCancelado = await criarCenarioFinanceiro('cancelado', 4000);

    await request(app.getHttpServer())
      .patch(
        `/planejamentos/${cenarioCancelado.planejamento.id}/gastos/${cenarioCancelado.gasto.id}/cancelar`,
      )
      .set('Authorization', authorization())
      .expect(200);
    const resumoCancelado = unwrapSuccess<ResumoResponse>(
      await request(app.getHttpServer())
        .get(`/planejamentos/${cenarioCancelado.planejamento.id}/resumo`)
        .set('Authorization', authorization())
        .expect(200),
    );

    expect(resumoCancelado).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        totalGastosAtivosCentavos: 0,
        obrigacaoResidualCentavos: 0,
      }),
    );

    const cenarioRevisao = await criarCenarioFinanceiro('revisao', 6000);
    await dataSource
      .getRepository(GastoPlanejamento)
      .update(cenarioRevisao.gasto.id, {
        status: GastoStatus.PENDENTE_REVISAO,
      });
    const resumoRevisao = unwrapSuccess<ResumoResponse>(
      await request(app.getHttpServer())
        .get(`/planejamentos/${cenarioRevisao.planejamento.id}/resumo`)
        .set('Authorization', authorization())
        .expect(200),
    );

    expect(resumoRevisao).toEqual(
      expect.objectContaining({
        situacaoFinanceira: 'QUITADO',
        totalGastosAtivosCentavos: 0,
        obrigacaoResidualCentavos: 0,
      }),
    );
  });

  it('returns 404 PLANEJAMENTO_NOT_FOUND to a user without access', async () => {
    const { planejamento } = await criarCenarioFinanceiro('isolamento', 2000);
    const response = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/resumo`)
      .set('Authorization', `Bearer ${usuarioSemAcesso.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_NOT_FOUND',
        }) as object,
      }),
    );
  });
});
