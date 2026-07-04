import { validate } from 'class-validator';
import {
  AddParticipantePlanejamentoDto,
  CreateGastoPlanejamentoDto,
  CreatePlanejamentoDto,
  FindGastoPlanejamentoParamsDto,
  FindGastosPlanejamentoParamsDto,
  FindPlanejamentoParamsDto,
  FindPlanejamentosDto,
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
});
