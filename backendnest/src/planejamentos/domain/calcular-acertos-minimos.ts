import { calcularSaldosParticipantes } from './calcular-saldos-participantes';
import {
  AcertoMinimoPlanejamento,
  AcertoPlanejamentoCalculo,
  GastoPlanejamentoCalculo,
  SaldoParticipantePlanejamento,
} from './types';

export function calcularAcertosMinimos(
  participantesIds: string[],
  gastos: GastoPlanejamentoCalculo[],
  acertos: AcertoPlanejamentoCalculo[] = [],
): AcertoMinimoPlanejamento[] {
  const saldos = calcularSaldosParticipantes(participantesIds, gastos, acertos);

  return calcularAcertosMinimosPorSaldos(saldos);
}

export function calcularAcertosMinimosPorSaldos(
  saldos: SaldoParticipantePlanejamento[],
): AcertoMinimoPlanejamento[] {
  const devedores = saldos
    .filter((saldo) => saldo.saldoAbertoCentavos < 0)
    .map((saldo) => ({
      participanteId: saldo.participanteId,
      valorRestanteCentavos: Math.abs(saldo.saldoAbertoCentavos),
    }));

  const recebedores = saldos
    .filter((saldo) => saldo.saldoAbertoCentavos > 0)
    .map((saldo) => ({
      participanteId: saldo.participanteId,
      valorRestanteCentavos: saldo.saldoAbertoCentavos,
    }));

  const acertos: AcertoMinimoPlanejamento[] = [];
  let indiceDevedor = 0;
  let indiceRecebedor = 0;

  while (
    indiceDevedor < devedores.length &&
    indiceRecebedor < recebedores.length
  ) {
    const devedor = devedores[indiceDevedor];
    const recebedor = recebedores[indiceRecebedor];
    const valorCentavos = Math.min(
      devedor.valorRestanteCentavos,
      recebedor.valorRestanteCentavos,
    );

    if (valorCentavos > 0) {
      acertos.push({
        devedorParticipanteId: devedor.participanteId,
        recebedorParticipanteId: recebedor.participanteId,
        valorCentavos,
      });
    }

    devedor.valorRestanteCentavos -= valorCentavos;
    recebedor.valorRestanteCentavos -= valorCentavos;

    if (devedor.valorRestanteCentavos === 0) {
      indiceDevedor += 1;
    }

    if (recebedor.valorRestanteCentavos === 0) {
      indiceRecebedor += 1;
    }
  }

  return acertos;
}
