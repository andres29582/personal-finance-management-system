import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import {
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoTipo,
} from '../src/planejamentos/enums';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import { registerAndLoginTestUser } from './helpers/auth.e2e-helper';
import { Identifiable, unwrapSuccess } from './helpers/http.helper';

type PlanejamentoResponse = Identifiable;

jest.setTimeout(60000);

describe('Planejamentos participant creation concurrency (e2e)', () => {
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

  async function criarPlanejamentoDoProprietario(dadosUsuario: {
    cpf: string;
    email: string;
    nome: string;
  }) {
    const session = await registerAndLoginTestUser(app, dadosUsuario);
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        nome: `Planejamento de ${dadosUsuario.nome}`,
        tipo: PlanejamentoTipo.VIAGEM,
      })
      .expect(201);

    return {
      planejamento: unwrapSuccess<PlanejamentoResponse>(response),
      session,
    };
  }

  function expectUmaCriacaoEUmConflito(respostas: Response[]): void {
    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([
      201, 409,
    ]);
    const conflito = respostas.find((resposta) => resposta.status === 409);

    expect(conflito?.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_PARTICIPANTE_DUPLICADO',
        }) as object,
        success: false,
      }),
    );
  }

  it('serializes concurrent manual participants with the same name', async () => {
    const { planejamento, session } = await criarPlanejamentoDoProprietario({
      cpf: '52998224725',
      email: 'participante.nome.concorrente.e2e@example.com',
      nome: 'Participante Nome Concorrente E2E',
    });
    const endpoint = `/planejamentos/${planejamento.id}/participantes`;
    const authorization = `Bearer ${session.token}`;

    const respostas = await Promise.all([
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({ nome: 'Participante Manual Repetido' }),
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({ nome: 'Participante Manual Repetido' }),
    ]);

    expectUmaCriacaoEUmConflito(respostas);

    const participantes = await dataSource
      .getRepository(ParticipantePlanejamento)
      .find({
        where: {
          nome: 'Participante Manual Repetido',
          planejamentoId: planejamento.id,
          status: ParticipanteStatus.ATIVO,
        },
      });

    expect(participantes).toHaveLength(1);
    expect(participantes[0]).toEqual(
      expect.objectContaining({
        tipo: ParticipanteTipo.MANUAL,
        usuarioId: null,
      }),
    );
  });

  it('serializes concurrent participants with the same email', async () => {
    const { planejamento, session } = await criarPlanejamentoDoProprietario({
      cpf: '39053344705',
      email: 'participante.email.concorrente.e2e@example.com',
      nome: 'Participante Email Concorrente E2E',
    });
    const endpoint = `/planejamentos/${planejamento.id}/participantes`;
    const authorization = `Bearer ${session.token}`;
    const emailDuplicado = 'convidado.concorrente@example.com';

    const respostas = await Promise.all([
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({ email: emailDuplicado, nome: 'Convidado Email Um' }),
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({ email: emailDuplicado, nome: 'Convidado Email Dois' }),
    ]);

    expectUmaCriacaoEUmConflito(respostas);

    const participantes = await dataSource
      .getRepository(ParticipantePlanejamento)
      .find({
        where: {
          email: emailDuplicado,
          planejamentoId: planejamento.id,
          status: ParticipanteStatus.ATIVO,
        },
      });

    expect(participantes).toHaveLength(1);
    expect(participantes[0]?.tipo).toBe(ParticipanteTipo.MANUAL);
  });

  it('serializes concurrent linked participants with the same usuarioId', async () => {
    const { planejamento, session } = await criarPlanejamentoDoProprietario({
      cpf: '68199965000',
      email: 'participante.usuario.concorrente.e2e@example.com',
      nome: 'Participante Usuario Concorrente E2E',
    });
    const usuarioVinculado = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'usuario.vinculado.concorrente.e2e@example.com',
      nome: 'Usuario Vinculado Concorrente E2E',
    });
    const endpoint = `/planejamentos/${planejamento.id}/participantes`;
    const authorization = `Bearer ${session.token}`;

    const respostas = await Promise.all([
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({
          nome: 'Usuario Vinculado Um',
          usuarioId: usuarioVinculado.userId,
        }),
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', authorization)
        .send({
          nome: 'Usuario Vinculado Dois',
          usuarioId: usuarioVinculado.userId,
        }),
    ]);

    expectUmaCriacaoEUmConflito(respostas);

    const participantes = await dataSource
      .getRepository(ParticipantePlanejamento)
      .find({
        where: {
          planejamentoId: planejamento.id,
          status: ParticipanteStatus.ATIVO,
          usuarioId: usuarioVinculado.userId,
        },
      });

    expect(participantes).toHaveLength(1);
    expect(participantes[0]?.tipo).toBe(ParticipanteTipo.VINCULADO);
  });
});
