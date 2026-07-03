import {
  AcertoStatus,
  DivisaoStatus,
  GastoComportamento,
  GastoStatus,
  ParticipanteStatus,
  ParticipanteTipo,
  PlanejamentoStatus,
  PlanejamentoTipo,
} from './index';

describe('enums de planejamentos', () => {
  it('exporta tipos de planejamento esperados', () => {
    expect(Object.values(PlanejamentoTipo)).toEqual([
      'CASA',
      'FESTA',
      'VIAGEM',
      'EVENTO',
      'GRUPO',
      'OUTRO',
    ]);
  });

  it('exporta status de planejamento esperados', () => {
    expect(Object.values(PlanejamentoStatus)).toEqual([
      'ABERTO',
      'FECHADO',
      'ARQUIVADO',
      'CANCELADO',
    ]);
  });

  it('exporta enums de participantes, gastos, divisoes e acertos', () => {
    expect(Object.values(ParticipanteTipo)).toEqual([
      'MANUAL',
      'CONVIDADO',
      'VINCULADO',
    ]);
    expect(Object.values(ParticipanteStatus)).toEqual([
      'ATIVO',
      'PENDENTE',
      'REMOVIDO',
    ]);
    expect(Object.values(GastoComportamento)).toEqual([
      'FIXO',
      'VARIAVEL',
      'EVENTUAL',
    ]);
    expect(Object.values(GastoStatus)).toEqual([
      'ATIVO',
      'CANCELADO',
      'PENDENTE_REVISAO',
    ]);
    expect(Object.values(DivisaoStatus)).toEqual(['ATIVA', 'CANCELADA']);
    expect(Object.values(AcertoStatus)).toEqual([
      'PENDENTE',
      'PAGO',
      'CONFIRMADO',
      'CANCELADO',
    ]);
  });
});
