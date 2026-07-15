import { validate } from 'class-validator';
import {
  AddParticipantePlanejamentoDto,
  CreateGastoPlanejamentoDto,
  CreatePlanejamentoDto,
  FindAcertoPlanejamentoParamsDto,
  FindAcertosPlanejamentoParamsDto,
  FindGastoPlanejamentoParamsDto,
  FindGastosPlanejamentoParamsDto,
  FindPlanejamentoParamsDto,
  FindPlanejamentosDto,
  RemoveParticipantePlanejamentoParamsDto,
  UpdateGastoPlanejamentoDto,
} from './index';
import {
  GastoComportamento,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from '../enums';

describe('Planejamento DTO validation', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';

  it('accepts a valid planejamento creation payload', async () => {
    const dto = Object.assign(new CreatePlanejamentoDto(), {
      nome: 'Viagem em grupo',
      descricao: 'Custos compartilhados da viagem',
      tipo: PlanejamentoTipo.VIAGEM,
      dataInicio: '2026-07-01',
      dataFim: '2026-07-15',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid planejamento creation payloads', async () => {
    const dto = Object.assign(new CreatePlanejamentoDto(), {
      nome: '',
      tipo: 'INVALIDO',
      dataInicio: '01/07/2026',
      dataFim: '2026-99-99',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['nome', 'tipo', 'dataInicio', 'dataFim']),
    );
  });

  it('accepts valid planejamento filters and params', async () => {
    const filtros = Object.assign(new FindPlanejamentosDto(), {
      status: PlanejamentoStatus.ABERTO,
    });
    const params = Object.assign(new FindPlanejamentoParamsDto(), {
      id: uuid,
    });

    await expect(validate(filtros)).resolves.toHaveLength(0);
    await expect(validate(params)).resolves.toHaveLength(0);
  });

  it('rejects invalid planejamento filters and params', async () => {
    const filtros = Object.assign(new FindPlanejamentosDto(), {
      status: 'INVALIDO',
    });
    const params = Object.assign(new FindPlanejamentoParamsDto(), {
      id: 'planejamento-id',
    });

    const filtroErrors = await validate(filtros);
    const paramErrors = await validate(params);

    expect(filtroErrors.map((error) => error.property)).toContain('status');
    expect(paramErrors.map((error) => error.property)).toContain('id');
  });

  it('accepts manual and linked participants', async () => {
    const manual = Object.assign(new AddParticipantePlanejamentoDto(), {
      nome: 'Bruno',
      email: 'bruno@example.com',
    });
    const vinculado = Object.assign(new AddParticipantePlanejamentoDto(), {
      nome: 'Carla',
      usuarioId: uuid,
    });

    await expect(validate(manual)).resolves.toHaveLength(0);
    await expect(validate(vinculado)).resolves.toHaveLength(0);
  });

  it('validates both ids used to remove a participant', async () => {
    const validos = Object.assign(
      new RemoveParticipantePlanejamentoParamsDto(),
      { planejamentoId: uuid, participanteId: uuid },
    );
    const invalidos = Object.assign(
      new RemoveParticipantePlanejamentoParamsDto(),
      { planejamentoId: 'invalido', participanteId: 'invalido' },
    );

    await expect(validate(validos)).resolves.toHaveLength(0);
    await expect(validate(invalidos)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'planejamentoId' }),
        expect.objectContaining({ property: 'participanteId' }),
      ]),
    );
  });

  it('rejects invalid participant payloads', async () => {
    const dto = Object.assign(new AddParticipantePlanejamentoDto(), {
      nome: '',
      email: 'email-invalido',
      usuarioId: 'usuario-invalido',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['nome', 'email', 'usuarioId']),
    );
  });

  it('accepts a valid shared expense creation payload', async () => {
    const dto = Object.assign(new CreateGastoPlanejamentoDto(), {
      descricao: 'Mercado',
      valorCentavos: 10001,
      dataGasto: '2026-07-04',
      comportamento: GastoComportamento.EVENTUAL,
      pagoPorParticipanteId: uuid,
      participantesIds: [uuid, '22222222-2222-4222-8222-222222222222'],
      categoria: 'Alimentacao',
      observacao: 'Compra compartilhada',
      mesReferencia: '2026-07',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid shared expense creation payloads', async () => {
    const dto = Object.assign(new CreateGastoPlanejamentoDto(), {
      descricao: '',
      valorCentavos: 0,
      dataGasto: '04/07/2026',
      comportamento: 'INVALIDO',
      pagoPorParticipanteId: 'pagador-invalido',
      participantesIds: [],
      mesReferencia: '07-2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'descricao',
        'valorCentavos',
        'dataGasto',
        'comportamento',
        'pagoPorParticipanteId',
        'participantesIds',
        'mesReferencia',
      ]),
    );
  });

  it('accepts a valid partial financial expense update', async () => {
    const dto = Object.assign(new UpdateGastoPlanejamentoDto(), {
      valorCentavos: 10001,
      pagoPorParticipanteId: uuid,
      participantesIds: [uuid],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a valid partial descriptive expense update with nullable fields', async () => {
    const dto = Object.assign(new UpdateGastoPlanejamentoDto(), {
      descricao: 'Mercado atualizado',
      categoria: null,
      observacao: null,
      mesReferencia: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid partial expense update fields', async () => {
    const dto = Object.assign(new UpdateGastoPlanejamentoDto(), {
      descricao: '',
      valorCentavos: 0,
      dataGasto: '04/07/2026',
      comportamento: 'INVALIDO',
      pagoPorParticipanteId: 'pagador-invalido',
      participantesIds: [],
      mesReferencia: '07-2026',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'descricao',
        'valorCentavos',
        'dataGasto',
        'comportamento',
        'pagoPorParticipanteId',
        'participantesIds',
        'mesReferencia',
      ]),
    );
  });

  it('rejects null for non-nullable partial expense update fields', async () => {
    const dto = Object.assign(new UpdateGastoPlanejamentoDto(), {
      descricao: null,
      valorCentavos: null,
      dataGasto: null,
      comportamento: null,
      pagoPorParticipanteId: null,
      participantesIds: null,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'descricao',
        'valorCentavos',
        'dataGasto',
        'comportamento',
        'pagoPorParticipanteId',
        'participantesIds',
      ]),
    );
  });

  it('accepts valid shared expense route params', async () => {
    const listaParams = Object.assign(new FindGastosPlanejamentoParamsDto(), {
      planejamentoId: uuid,
    });
    const detalheParams = Object.assign(new FindGastoPlanejamentoParamsDto(), {
      planejamentoId: uuid,
      gastoId: '22222222-2222-4222-8222-222222222222',
    });

    await expect(validate(listaParams)).resolves.toHaveLength(0);
    await expect(validate(detalheParams)).resolves.toHaveLength(0);
  });

  it('accepts and rejects shared settlement route params', async () => {
    const valido = Object.assign(new FindAcertosPlanejamentoParamsDto(), {
      planejamentoId: uuid,
    });
    const invalido = Object.assign(new FindAcertosPlanejamentoParamsDto(), {
      planejamentoId: 'planejamento-id',
    });

    await expect(validate(valido)).resolves.toHaveLength(0);

    const errors = await validate(invalido);

    expect(errors.map((error) => error.property)).toContain('planejamentoId');
  });

  it('accepts and rejects persisted settlement management route params', async () => {
    const valido = Object.assign(new FindAcertoPlanejamentoParamsDto(), {
      planejamentoId: uuid,
      acertoId: '22222222-2222-4222-8222-222222222222',
    });
    const invalido = Object.assign(new FindAcertoPlanejamentoParamsDto(), {
      planejamentoId: 'planejamento-id',
      acertoId: 'acerto-id',
    });

    await expect(validate(valido)).resolves.toHaveLength(0);

    const errors = await validate(invalido);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['planejamentoId', 'acertoId']),
    );
  });
});
