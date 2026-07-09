import { parseDecimalInput } from '../../../../utils/number-input';
import type { Divida, Periodicidade, UpdateDividaRequestDto } from '../types/divida';

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

export function buildDividaUpdatePayload(
  values: DividaPayloadFormValues,
): UpdateDividaRequestDto {
  const interest = parseDecimalInput(values.tasaInteres);
  const monthlyPayment = parseDecimalInput(values.cuotaMensual);

  return {
    cuotaMensual: Number.isFinite(monthlyPayment) ? monthlyPayment : undefined,
    fechaVencimiento: values.fechaVencimiento,
    nome: values.nome.trim(),
    periodicidade: values.periodicidade,
    proximoVencimiento: values.proximoVencimiento || undefined,
    tasaInteres: Number.isFinite(interest) ? interest : undefined,
  };
}

export function mapDividaToFormValues(divida: Divida): DividaPayloadFormValues {
  return {
    contaId: divida.contaId || '',
    cuotaMensual: divida.cuotaMensual === null ? '' : String(divida.cuotaMensual),
    fechaInicio: divida.fechaInicio,
    fechaVencimiento: divida.fechaVencimiento,
    montoTotal: String(divida.montoTotal),
    nome: divida.nome,
    periodicidade: divida.periodicidade || 'mensal',
    proximoVencimiento: divida.proximoVencimiento || '',
    tasaInteres: divida.tasaInteres === null ? '' : String(divida.tasaInteres),
  };
}
