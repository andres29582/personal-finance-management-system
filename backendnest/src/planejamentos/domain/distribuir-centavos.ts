import {
  assertInteiroCentavos,
  assertValorPositivoCentavos,
  PlanejamentoDominioError,
} from './types';

export function distribuirCentavos(
  valorCentavos: number,
  quantidadePartes: number,
): number[] {
  assertValorPositivoCentavos(valorCentavos, 'Valor do gasto');
  assertInteiroCentavos(quantidadePartes, 'Quantidade de participantes');

  if (quantidadePartes <= 0) {
    throw new PlanejamentoDominioError(
      'PARTICIPANTES_OBRIGATORIOS',
      'Lista de participantes nao pode estar vazia.',
    );
  }

  if (valorCentavos < quantidadePartes) {
    throw new PlanejamentoDominioError(
      'VALOR_MENOR_QUE_PARTICIPANTES',
      'Valor nao pode ser menor que a quantidade de participantes.',
    );
  }

  const valorBase = Math.floor(valorCentavos / quantidadePartes);
  const sobra = valorCentavos % quantidadePartes;

  return Array.from({ length: quantidadePartes }, (_, indice) =>
    indice < sobra ? valorBase + 1 : valorBase,
  );
}
