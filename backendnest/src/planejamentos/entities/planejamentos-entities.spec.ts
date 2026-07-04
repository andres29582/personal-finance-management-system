import { AcertoPlanejamento } from './acerto-planejamento.entity';
import { DivisaoGasto } from './divisao-gasto.entity';
import { GastoPlanejamento } from './gasto-planejamento.entity';
import { ParticipantePlanejamento } from './participante-planejamento.entity';
import { Planejamento } from './planejamento.entity';

describe('entidades de planejamentos', () => {
  it('instancia as entidades persistentes principais', () => {
    expect(new Planejamento()).toBeInstanceOf(Planejamento);
    expect(new ParticipantePlanejamento()).toBeInstanceOf(
      ParticipantePlanejamento,
    );
    expect(new GastoPlanejamento()).toBeInstanceOf(GastoPlanejamento);
    expect(new DivisaoGasto()).toBeInstanceOf(DivisaoGasto);
    expect(new AcertoPlanejamento()).toBeInstanceOf(AcertoPlanejamento);
  });
});
