import { calcularSaldosParticipantes } from './calcular-saldos-participantes';
import {
  AcertoPlanejamentoCalculo,
  GastoPlanejamentoCalculo,
  ResumoFinanceiroPlanejamentoDominio,
} from './types';

export function calcularResumoFinanceiroPlanejamento(
  participantesIds: string[],
  gastos: GastoPlanejamentoCalculo[],
  acertos: AcertoPlanejamentoCalculo[] = [],
): ResumoFinanceiroPlanejamentoDominio {
  const participantes = calcularSaldosParticipantes(
    participantesIds,
    gastos,
    acertos,
  );
  const totalGastosAtivosCentavos = gastos
    .filter((gasto) => gasto.status === 'ATIVO')
    .reduce((total, gasto) => total + gasto.valorCentavos, 0);
  const obrigacaoResidualCentavos = participantes
    .filter((participante) => participante.saldoAbertoCentavos > 0)
    .reduce(
      (total, participante) => total + participante.saldoAbertoCentavos,
      0,
    );

  return {
    situacaoFinanceira: participantes.every(
      (participante) => participante.saldoAbertoCentavos === 0,
    )
      ? 'QUITADO'
      : 'PENDENTE',
    totalGastosAtivosCentavos,
    obrigacaoResidualCentavos,
    participantes,
  };
}
