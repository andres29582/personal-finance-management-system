import { participanteRepresentaProprietario } from './participante-representa-proprietario';

describe('participanteRepresentaProprietario', () => {
  it('identifica o proprietario pela associacao do planejamento e usuario criador', () => {
    expect(
      participanteRepresentaProprietario(
        { id: 'planejamento-1', usuarioCriadorId: 'usuario-1' },
        { planejamentoId: 'planejamento-1', usuarioId: 'usuario-1' },
      ),
    ).toBe(true);
  });

  it('nao identifica participante de outro planejamento ou usuario', () => {
    expect(
      participanteRepresentaProprietario(
        { id: 'planejamento-1', usuarioCriadorId: 'usuario-1' },
        { planejamentoId: 'planejamento-2', usuarioId: 'usuario-1' },
      ),
    ).toBe(false);
    expect(
      participanteRepresentaProprietario(
        { id: 'planejamento-1', usuarioCriadorId: 'usuario-1' },
        { planejamentoId: 'planejamento-1', usuarioId: 'usuario-2' },
      ),
    ).toBe(false);
  });
});
