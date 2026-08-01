import request from 'supertest';
import { DataSource } from 'typeorm';
import { calcularDivisaoIgualitaria } from '../src/planejamentos/domain';
import { AcertoPlanejamento } from '../src/planejamentos/entities/acerto-planejamento.entity';
import { DivisaoGasto } from '../src/planejamentos/entities/divisao-gasto.entity';
import { GastoPlanejamento } from '../src/planejamentos/entities/gasto-planejamento.entity';
import { ParticipantePlanejamento } from '../src/planejamentos/entities/participante-planejamento.entity';
import {
  AcertoStatus,
  DivisaoStatus,
  GastoComportamento,
  GastoStatus,
  ParticipanteStatus,
  PlanejamentoTipo,
} from '../src/planejamentos/enums';
import { createE2eApp, type E2eApplication } from './e2e-app';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';
import {
  type E2eAuthSession,
  registerAndLoginTestUser,
} from './helpers/auth.e2e-helper';
import { Identifiable, unwrapSuccess } from './helpers/http.helper';

type ParticipanteResponse = Identifiable & {
  status: ParticipanteStatus;
  usuarioId: string | null;
};

type PlanejamentoResponse = Identifiable & {
  participantes: ParticipanteResponse[];
};

type GastoResponse = Identifiable & {
  descricao: string;
  divisoes: Array<
    Identifiable & {
      participanteId: string;
      status: DivisaoStatus;
      valorDevidoCentavos: number;
    }
  >;
  observacao: string | null;
  pagoPorParticipanteId: string;
  status: GastoStatus;
  ultimaAlteracaoValorEm: string | null;
  valorCentavos: number;
};

type CenarioGasto = {
  gasto: GastoResponse;
  participanteProprietario: ParticipanteResponse;
  planejamento: PlanejamentoResponse;
};

const ordenarPorId = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

const snapshotDivisoes = (divisoes: DivisaoGasto[]) =>
  ordenarPorId(divisoes).map((divisao) => ({
    id: divisao.id,
    participanteId: divisao.participanteId,
    status: divisao.status,
    valorDevidoCentavos: divisao.valorDevidoCentavos,
  }));

const snapshotAcertos = (acertos: AcertoPlanejamento[]) =>
  ordenarPorId(acertos).map((acerto) => ({
    dataPagamento: acerto.dataPagamento?.toISOString() ?? null,
    deParticipanteId: acerto.deParticipanteId,
    id: acerto.id,
    observacao: acerto.observacao,
    paraParticipanteId: acerto.paraParticipanteId,
    status: acerto.status,
    valorCentavos: acerto.valorCentavos,
  }));

const snapshotGasto = (gasto: GastoPlanejamento) => ({
  categoria: gasto.categoria,
  comportamento: gasto.comportamento,
  comprovanteNome: gasto.comprovanteNome,
  comprovanteUrl: gasto.comprovanteUrl,
  dataGasto: gasto.dataGasto,
  deletedAt: gasto.deletedAt?.toISOString() ?? null,
  descricao: gasto.descricao,
  id: gasto.id,
  mesReferencia: gasto.mesReferencia,
  observacao: gasto.observacao,
  pagoPorParticipanteId: gasto.pagoPorParticipanteId,
  planejamentoId: gasto.planejamentoId,
  requerRevisaoMensal: gasto.requerRevisaoMensal,
  status: gasto.status,
  ultimaAlteracaoValorEm: gasto.ultimaAlteracaoValorEm?.toISOString() ?? null,
  valorCentavos: gasto.valorCentavos,
});

jest.setTimeout(60000);

describe('Planejamentos expense update (e2e)', () => {
  let app: E2eApplication;
  let dataSource: DataSource;
  let proprietario: E2eAuthSession;
  let usuarioParticipante: E2eAuthSession;
  let usuarioNaoVinculado: E2eAuthSession;

  beforeAll(async () => {
    const databaseConfig = configureE2eEnvironment();
    await prepareE2eDatabase(databaseConfig);

    app = await createE2eApp();
    dataSource = app.get(DataSource);
    proprietario = await registerAndLoginTestUser(app, {
      cpf: '52998224725',
      email: 'planejamentos.gastos.update.owner.e2e@example.com',
      nome: 'Proprietario Update Gasto E2E',
    });
    usuarioParticipante = await registerAndLoginTestUser(app, {
      cpf: '11144477735',
      email: 'planejamentos.gastos.update.participant.e2e@example.com',
      nome: 'Participante Update Gasto E2E',
    });
    usuarioNaoVinculado = await registerAndLoginTestUser(app, {
      cpf: '39053344705',
      email: 'planejamentos.gastos.update.outsider.e2e@example.com',
      nome: 'Usuario Nao Vinculado Update Gasto E2E',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const criarPlanejamento = async (
    nome: string,
    session: E2eAuthSession = proprietario,
  ) => {
    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ nome, tipo: PlanejamentoTipo.VIAGEM })
      .expect(201);
    const planejamento = unwrapSuccess<PlanejamentoResponse>(response);
    const participanteProprietario = planejamento.participantes.find(
      (participante) => participante.usuarioId === session.userId,
    );

    expect(participanteProprietario).toBeDefined();

    return {
      participanteProprietario:
        participanteProprietario as ParticipanteResponse,
      planejamento,
    };
  };

  const adicionarParticipante = async (
    planejamentoId: string,
    nome: string,
    usuarioId?: string,
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamentoId}/participantes`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({ nome, ...(usuarioId ? { usuarioId } : {}) })
      .expect(201);

    return unwrapSuccess<ParticipanteResponse>(response);
  };

  const criarGasto = async (
    planejamentoId: string,
    pagoPorParticipanteId: string,
    participantesIds: string[],
    descricao: string,
    valorCentavos = 10000,
    session: E2eAuthSession = proprietario,
  ) => {
    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamentoId}/gastos`)
      .set('Authorization', `Bearer ${session.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao,
        pagoPorParticipanteId,
        participantesIds,
        valorCentavos,
      })
      .expect(201);

    return unwrapSuccess<GastoResponse>(response);
  };

  const criarCenarioComGasto = async (
    nomePlanejamento: string,
    nomeParticipante: string,
    descricao: string,
  ): Promise<CenarioGasto & { participanteDevedor: ParticipanteResponse }> => {
    const { planejamento, participanteProprietario } =
      await criarPlanejamento(nomePlanejamento);
    const participanteDevedor = await adicionarParticipante(
      planejamento.id,
      nomeParticipante,
    );
    const gasto = await criarGasto(
      planejamento.id,
      participanteProprietario.id,
      [participanteProprietario.id, participanteDevedor.id],
      descricao,
    );

    return {
      gasto,
      participanteDevedor,
      participanteProprietario,
      planejamento,
    };
  };

  it('updates only descriptive fields without financial reconciliation', async () => {
    const { gasto, participanteProprietario, planejamento } =
      await criarCenarioComGasto(
        'Atualizacao descritiva isolada',
        'Devedor do ajuste descritivo',
        'Mercado original',
      );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const gastoAntes = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });
    const divisoesAntes = snapshotDivisoes(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    );
    const acertosAntes = snapshotAcertos(
      await acertoRepository.find({
        where: {
          planejamentoId: planejamento.id,
          status: AcertoStatus.PENDENTE,
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({
        descricao: 'Mercado revisado',
        observacao: 'Somente ajuste descritivo',
      })
      .expect(200);
    const atualizado = unwrapSuccess<GastoResponse>(response);
    const gastoDepois = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });

    expect(atualizado).toEqual(
      expect.objectContaining({
        descricao: 'Mercado revisado',
        observacao: 'Somente ajuste descritivo',
        pagoPorParticipanteId: participanteProprietario.id,
        status: GastoStatus.ATIVO,
        valorCentavos: 10000,
      }),
    );
    expect(gastoDepois.ultimaAlteracaoValorEm).toEqual(
      gastoAntes.ultimaAlteracaoValorEm,
    );
    expect(
      snapshotDivisoes(
        await divisaoRepository.find({ where: { gastoId: gasto.id } }),
      ),
    ).toEqual(divisoesAntes);
    expect(
      snapshotAcertos(
        await acertoRepository.find({
          where: {
            planejamentoId: planejamento.id,
            status: AcertoStatus.PENDENTE,
          },
        }),
      ),
    ).toEqual(acertosAntes);
  });

  it('updates only the payer while preserving divisions', async () => {
    const {
      gasto,
      participanteDevedor: novoPagador,
      participanteProprietario,
      planejamento,
    } = await criarCenarioComGasto(
      'Mudanca isolada de pagador',
      'Novo pagador',
      'Hospedagem com novo pagador',
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const gastoAntes = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });
    const divisoesAntes = snapshotDivisoes(
      await divisaoRepository.find({
        where: { gastoId: gasto.id, status: DivisaoStatus.ATIVA },
      }),
    );
    const acertosAntes = await acertoRepository.find({
      where: {
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      },
    });

    expect(acertosAntes).toEqual([
      expect.objectContaining({
        deParticipanteId: novoPagador.id,
        paraParticipanteId: participanteProprietario.id,
        valorCentavos: 5000,
      }),
    ]);

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({ pagoPorParticipanteId: novoPagador.id })
      .expect(200);
    const atualizado = unwrapSuccess<GastoResponse>(response);
    const gastoDepois = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });
    const todasDivisoesDepois = await divisaoRepository.find({
      where: { gastoId: gasto.id },
    });
    const acertosPendentesDepois = await acertoRepository.find({
      where: {
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      },
    });

    expect({
      pagadorPersistido: gastoDepois.pagoPorParticipanteId,
      pagadorResposta: atualizado.pagoPorParticipanteId,
    }).toEqual({
      pagadorPersistido: novoPagador.id,
      pagadorResposta: novoPagador.id,
    });
    expect(gastoDepois.ultimaAlteracaoValorEm).toEqual(
      gastoAntes.ultimaAlteracaoValorEm,
    );
    expect(snapshotDivisoes(todasDivisoesDepois)).toEqual(divisoesAntes);
    expect(todasDivisoesDepois).toHaveLength(divisoesAntes.length);
    expect(acertosPendentesDepois).toEqual([
      expect.objectContaining({
        deParticipanteId: participanteProprietario.id,
        paraParticipanteId: novoPagador.id,
        valorCentavos: 5000,
      }),
    ]);
    expect(acertosPendentesDepois).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deParticipanteId: novoPagador.id,
          paraParticipanteId: participanteProprietario.id,
        }),
      ]),
    );
  });

  it('replaces divisions canonically when value and participants change', async () => {
    const { planejamento, participanteProprietario } = await criarPlanejamento(
      'Mudanca de valor e participantes',
    );
    const participantesCriados = await Promise.all([
      adicionarParticipante(planejamento.id, 'Participante rateio um'),
      adicionarParticipante(planejamento.id, 'Participante rateio dois'),
    ]);
    const [participanteB, participanteC] = [...participantesCriados].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    const gasto = await criarGasto(
      planejamento.id,
      participanteProprietario.id,
      [participanteProprietario.id, participanteB.id],
      'Passeio com rateio inicial',
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const gastoAntes = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });
    const divisoesAtivasAntes = await divisaoRepository.find({
      where: { gastoId: gasto.id, status: DivisaoStatus.ATIVA },
    });
    const idsHistoricos = divisoesAtivasAntes.map((divisao) => divisao.id);
    const ordemRecebida = [
      participanteC.id,
      participanteB.id,
      participanteProprietario.id,
    ];
    const ordemCanonica = [
      participanteProprietario.id,
      participanteB.id,
      participanteC.id,
    ].sort((a, b) => a.localeCompare(b));

    expect(ordemRecebida).not.toEqual(ordemCanonica);

    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({ participantesIds: ordemRecebida, valorCentavos: 10001 })
      .expect(200);

    const gastoDepois = await gastoRepository.findOneOrFail({
      where: { id: gasto.id, planejamentoId: planejamento.id },
    });
    const divisoesDepois = await divisaoRepository.find({
      where: { gastoId: gasto.id },
    });
    const historicas = divisoesDepois.filter((divisao) =>
      idsHistoricos.includes(divisao.id),
    );
    const novasAtivas = divisoesDepois.filter(
      (divisao) => divisao.status === DivisaoStatus.ATIVA,
    );
    const divisaoEsperada = calcularDivisaoIgualitaria(10001, ordemCanonica);
    const valoresEsperados = divisaoEsperada.map((divisao) => ({
      participanteId: divisao.participanteId,
      valorDevidoCentavos: divisao.valorCentavos,
    }));
    const valoresAtivos = novasAtivas
      .map((divisao) => ({
        participanteId: divisao.participanteId,
        valorDevidoCentavos: divisao.valorDevidoCentavos,
      }))
      .sort((a, b) => a.participanteId.localeCompare(b.participanteId));
    const acertosPendentes = await acertoRepository.find({
      where: {
        planejamentoId: planejamento.id,
        status: AcertoStatus.PENDENTE,
      },
    });
    const divisaoB = valoresEsperados.find(
      (divisao) => divisao.participanteId === participanteB.id,
    );
    const divisaoC = valoresEsperados.find(
      (divisao) => divisao.participanteId === participanteC.id,
    );

    expect(gastoDepois).toEqual(
      expect.objectContaining({
        pagoPorParticipanteId: participanteProprietario.id,
        status: GastoStatus.ATIVO,
        valorCentavos: 10001,
      }),
    );
    expect(gastoDepois.ultimaAlteracaoValorEm).not.toBeNull();
    expect(gastoDepois.ultimaAlteracaoValorEm).not.toEqual(
      gastoAntes.ultimaAlteracaoValorEm,
    );
    expect(historicas).toHaveLength(2);
    expect(
      historicas.every((divisao) => divisao.status === DivisaoStatus.CANCELADA),
    ).toBe(true);
    expect(divisoesDepois).toHaveLength(5);
    expect(novasAtivas).toHaveLength(3);
    expect(
      novasAtivas.every((divisao) => !idsHistoricos.includes(divisao.id)),
    ).toBe(true);
    expect(
      novasAtivas.reduce(
        (total, divisao) => total + divisao.valorDevidoCentavos,
        0,
      ),
    ).toBe(10001);
    expect(
      new Set(novasAtivas.map((divisao) => divisao.participanteId)).size,
    ).toBe(3);
    expect(valoresAtivos).toEqual(valoresEsperados);
    expect(acertosPendentes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deParticipanteId: participanteB.id,
          paraParticipanteId: participanteProprietario.id,
          valorCentavos: divisaoB?.valorDevidoCentavos,
        }),
        expect.objectContaining({
          deParticipanteId: participanteC.id,
          paraParticipanteId: participanteProprietario.id,
          valorCentavos: divisaoC?.valorDevidoCentavos,
        }),
      ]),
    );
    expect(acertosPendentes).toHaveLength(2);
    expect(
      acertosPendentes.reduce(
        (total, acerto) => total + acerto.valorCentavos,
        0,
      ),
    ).toBe(
      novasAtivas
        .filter(
          (divisao) => divisao.participanteId !== participanteProprietario.id,
        )
        .reduce((total, divisao) => total + divisao.valorDevidoCentavos, 0),
    );
  });

  it('rejects an empty update without modifying persisted state', async () => {
    const { gasto, planejamento } = await criarCenarioComGasto(
      'Atualizacao vazia',
      'Devedor da atualizacao vazia',
      'Gasto preservado na atualizacao vazia',
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);
    const gastoAntes = snapshotGasto(
      await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
    );
    const divisoesAntes = snapshotDivisoes(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    );
    const acertosAntes = snapshotAcertos(
      await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({})
      .expect(422);

    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_GASTO_ATUALIZACAO_VAZIA',
        }) as object,
        success: false,
      }),
    );
    expect(
      snapshotGasto(
        await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
      ),
    ).toEqual(gastoAntes);
    expect(
      snapshotDivisoes(
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
  });

  it('rejects updates to a cancelled expense without recreating divisions', async () => {
    const { gasto, planejamento } = await criarCenarioComGasto(
      'Gasto cancelado inalteravel',
      'Devedor do gasto cancelado',
      'Gasto que sera cancelado',
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);

    await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}/cancelar`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);
    const divisoesCanceladasAntes = snapshotDivisoes(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .send({ descricao: 'Descricao nao permitida' })
      .expect(422);

    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_GASTO_ATUALIZAR_STATUS_INVALIDO',
          details: expect.objectContaining({
            statusAtual: GastoStatus.CANCELADO,
          }) as object,
        }) as object,
        success: false,
      }),
    );
    expect(
      await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
    ).toEqual(expect.objectContaining({ status: GastoStatus.CANCELADO }));
    expect(
      snapshotDivisoes(
        await divisaoRepository.find({ where: { gastoId: gasto.id } }),
      ),
    ).toEqual(divisoesCanceladasAntes);
    expect(
      divisoesCanceladasAntes.every(
        (divisao) => divisao.status === DivisaoStatus.CANCELADA,
      ),
    ).toBe(true);
  });

  it('hydrates the complete aggregate for a linked participant and creates a shared expense', async () => {
    const { planejamento, participanteProprietario } = await criarPlanejamento(
      'Agregado completo para participante vinculado',
    );
    const participanteVinculado = await adicionarParticipante(
      planejamento.id,
      'Usuario participante vinculado',
      usuarioParticipante.userId,
    );
    const participanteHistorico = await adicionarParticipante(
      planejamento.id,
      'Participante historico',
    );
    await request(app.getHttpServer())
      .delete(
        `/planejamentos/${planejamento.id}/participantes/${participanteHistorico.id}`,
      )
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);

    const detalheProprietarioResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);
    const detalheVinculadoResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(200);
    const listagemVinculadoResponse = await request(app.getHttpServer())
      .get('/planejamentos')
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(200);
    const detalheProprietario = unwrapSuccess<PlanejamentoResponse>(
      detalheProprietarioResponse,
    );
    const detalheVinculado = unwrapSuccess<PlanejamentoResponse>(
      detalheVinculadoResponse,
    );
    const planejamentoListado = unwrapSuccess<PlanejamentoResponse[]>(
      listagemVinculadoResponse,
    ).find((item) => item.id === planejamento.id);
    const participantesEsperados = [
      participanteProprietario.id,
      participanteVinculado.id,
      participanteHistorico.id,
    ].sort();
    const listarParticipantesIds = (item: PlanejamentoResponse) =>
      item.participantes.map((participante) => participante.id).sort();

    expect(listarParticipantesIds(detalheProprietario)).toEqual(
      participantesEsperados,
    );
    expect(listarParticipantesIds(detalheVinculado)).toEqual(
      participantesEsperados,
    );
    expect(planejamentoListado).toBeDefined();
    if (!planejamentoListado) {
      throw new Error(
        'Planejamento acessivel nao retornado na listagem do participante.',
      );
    }
    expect(listarParticipantesIds(planejamentoListado)).toEqual(
      participantesEsperados,
    );
    expect(
      detalheVinculado.participantes.find(
        (participante) => participante.id === participanteHistorico.id,
      ),
    ).toEqual(
      expect.objectContaining({
        status: ParticipanteStatus.REMOVIDO,
      }),
    );

    const gasto = await criarGasto(
      planejamento.id,
      participanteProprietario.id,
      [participanteProprietario.id, participanteVinculado.id],
      'Gasto compartilhado criado pelo vinculado',
      10001,
      usuarioParticipante,
    );
    const gastoRepository = dataSource.getRepository(GastoPlanejamento);
    const divisaoRepository = dataSource.getRepository(DivisaoGasto);
    const acertoRepository = dataSource.getRepository(AcertoPlanejamento);

    expect(gasto).toEqual(
      expect.objectContaining({
        pagoPorParticipanteId: participanteProprietario.id,
        status: GastoStatus.ATIVO,
        valorCentavos: 10001,
      }),
    );
    expect(gasto.divisoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participanteId: participanteProprietario.id,
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5001,
        }),
        expect.objectContaining({
          participanteId: participanteVinculado.id,
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]),
    );
    expect(
      await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
    ).toEqual(
      expect.objectContaining({
        pagoPorParticipanteId: participanteProprietario.id,
        valorCentavos: 10001,
      }),
    );
    expect(
      snapshotDivisoes(
        await divisaoRepository.find({ where: { gastoId: gasto.id } }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          participanteId: participanteProprietario.id,
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5001,
        }),
        expect.objectContaining({
          participanteId: participanteVinculado.id,
          status: DivisaoStatus.ATIVA,
          valorDevidoCentavos: 5000,
        }),
      ]),
    );

    const resumoProprietarioResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/resumo`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);
    const resumoVinculadoResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/resumo`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(200);
    const acertosProprietarioResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);
    const acertosVinculadoResponse = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}/acertos`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(200);
    const resumoProprietario = unwrapSuccess<Record<string, unknown>>(
      resumoProprietarioResponse,
    );
    const resumoVinculado = unwrapSuccess<Record<string, unknown>>(
      resumoVinculadoResponse,
    );
    const acertosProprietario = unwrapSuccess<Array<Record<string, unknown>>>(
      acertosProprietarioResponse,
    );
    const acertosVinculado = unwrapSuccess<Array<Record<string, unknown>>>(
      acertosVinculadoResponse,
    );

    expect(resumoVinculado).toEqual(resumoProprietario);
    expect(acertosVinculado).toEqual(acertosProprietario);
    expect(acertosVinculado).toEqual([
      expect.objectContaining({
        deParticipanteId: participanteVinculado.id,
        paraParticipanteId: participanteProprietario.id,
        status: AcertoStatus.PENDENTE,
        valorCentavos: 5000,
      }),
    ]);

    const gastoAntes = snapshotGasto(
      await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
    );
    const divisoesAntes = snapshotDivisoes(
      await divisaoRepository.find({ where: { gastoId: gasto.id } }),
    );
    const acertosAntes = snapshotAcertos(
      await acertoRepository.find({
        where: { planejamentoId: planejamento.id },
      }),
    );
    const updateResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .send({ descricao: 'Tentativa do participante' })
      .expect(403);

    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_OWNER_REQUIRED',
        }) as object,
        success: false,
      }),
    );
    const cancelResponse = await request(app.getHttpServer())
      .patch(`/planejamentos/${planejamento.id}/gastos/${gasto.id}/cancelar`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(403);

    expect(cancelResponse.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_OWNER_REQUIRED',
        }) as object,
        success: false,
      }),
    );
    expect(
      snapshotGasto(
        await gastoRepository.findOneOrFail({ where: { id: gasto.id } }),
      ),
    ).toEqual(gastoAntes);
    expect(
      snapshotDivisoes(
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
  });

  it('hides the aggregate and expense creation from a non-linked user', async () => {
    const { planejamento, participanteProprietario } = await criarPlanejamento(
      'Acesso negado para usuario nao vinculado',
    );

    await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', `Bearer ${usuarioNaoVinculado.token}`)
      .expect(404);
    const listagemResponse = await request(app.getHttpServer())
      .get('/planejamentos')
      .set('Authorization', `Bearer ${usuarioNaoVinculado.token}`)
      .expect(200);
    expect(
      unwrapSuccess<PlanejamentoResponse[]>(listagemResponse).some(
        (item) => item.id === planejamento.id,
      ),
    ).toBe(false);

    const response = await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', `Bearer ${usuarioNaoVinculado.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Tentativa sem vinculo',
        pagoPorParticipanteId: participanteProprietario.id,
        participantesIds: [participanteProprietario.id],
        valorCentavos: 10000,
      })
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'PLANEJAMENTO_NOT_FOUND',
        }) as object,
        success: false,
      }),
    );
    expect(
      await dataSource
        .getRepository(GastoPlanejamento)
        .countBy({ planejamentoId: planejamento.id }),
    ).toBe(0);
  });

  it('hides the aggregate and expense creation after removing the linked participant', async () => {
    const { planejamento, participanteProprietario } = await criarPlanejamento(
      'Acesso negado apos remocao',
    );
    const participanteVinculado = await adicionarParticipante(
      planejamento.id,
      'Participante vinculado removido',
      usuarioParticipante.userId,
    );

    await request(app.getHttpServer())
      .delete(
        `/planejamentos/${planejamento.id}/participantes/${participanteVinculado.id}`,
      )
      .set('Authorization', `Bearer ${proprietario.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(404);
    const listagemResponse = await request(app.getHttpServer())
      .get('/planejamentos')
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(200);
    expect(
      unwrapSuccess<PlanejamentoResponse[]>(listagemResponse).some(
        (item) => item.id === planejamento.id,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Tentativa apos remocao',
        pagoPorParticipanteId: participanteProprietario.id,
        participantesIds: [participanteProprietario.id],
        valorCentavos: 10000,
      })
      .expect(404);
    expect(
      await dataSource
        .getRepository(GastoPlanejamento)
        .countBy({ planejamentoId: planejamento.id }),
    ).toBe(0);
  });

  it('hides the aggregate and expense creation from a pending linked participant', async () => {
    const { planejamento, participanteProprietario } = await criarPlanejamento(
      'Acesso negado para participante pendente',
    );
    const participanteVinculado = await adicionarParticipante(
      planejamento.id,
      'Participante vinculado pendente',
      usuarioParticipante.userId,
    );
    await dataSource
      .getRepository(ParticipantePlanejamento)
      .update(
        { id: participanteVinculado.id },
        { status: ParticipanteStatus.PENDENTE },
      );

    await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.id}`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/planejamentos/${planejamento.id}/gastos`)
      .set('Authorization', `Bearer ${usuarioParticipante.token}`)
      .send({
        comportamento: GastoComportamento.EVENTUAL,
        dataGasto: '2026-07-14',
        descricao: 'Tentativa enquanto pendente',
        pagoPorParticipanteId: participanteProprietario.id,
        participantesIds: [participanteProprietario.id],
        valorCentavos: 10000,
      })
      .expect(404);
    expect(
      await dataSource
        .getRepository(GastoPlanejamento)
        .countBy({ planejamentoId: planejamento.id }),
    ).toBe(0);
  });
});
