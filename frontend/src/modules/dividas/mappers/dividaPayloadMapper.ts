import { parseDecimalInput } from '../../../../utils/number-input';
import type { Periodicidade } from '../types/divida';

export type DividaPayloadFormValues = {
  contaId: string;
  cuotaMensual: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: string;
  nome: string;
  periodicidade: Periodicidade;
  proximoVencimiento: string;
  tasaInteres: string;
};

export type DividaPayload = {
  contaId: string | undefined;
  cuotaMensual: number | undefined;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: number;
  nome: string;
  periodicidade: Periodicidade;
  proximoVencimiento: string | undefined;
  tasaInteres: number | undefined;
};

export function buildDividaPayload(values: DividaPayloadFormValues): DividaPayload {
  const total = parseDecimalInput(values.montoTotal);
  const interest = parseDecimalInput(values.tasaInteres);
  const monthlyPayment = parseDecimalInput(values.cuotaMensual);

  return {
    contaId: values.contaId || undefined,
    cuotaMensual: Number.isFinite(monthlyPayment) ? monthlyPayment : undefined,
    fechaInicio: values.fechaInicio,
    fechaVencimiento: values.fechaVencimiento,
    montoTotal: total,
    nome: values.nome.trim(),
    periodicidade: values.periodicidade,
    proximoVencimiento: values.proximoVencimiento || undefined,
    tasaInteres: Number.isFinite(interest) ? interest : undefined,
  };
}
