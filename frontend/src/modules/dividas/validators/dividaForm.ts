import { parseDecimalInput } from '../../../../utils/number-input';
import { isValidDateInput } from './dateInput';

export type DividaField =
  | 'cuotaMensual'
  | 'fechaInicio'
  | 'fechaVencimiento'
  | 'montoTotal'
  | 'nome'
  | 'proximoVencimiento'
  | 'tasaInteres';

export type DividaFormValues = {
  cuotaMensual: string;
  fechaInicio: string;
  fechaVencimiento: string;
  montoTotal: string;
  nome: string;
  proximoVencimiento: string;
  tasaInteres: string;
};

export type DividaFieldErrors = Partial<Record<DividaField, string>>;

export function validateDividaForm({
  cuotaMensual,
  fechaInicio,
  fechaVencimiento,
  montoTotal,
  nome,
  proximoVencimiento,
  tasaInteres,
}: DividaFormValues): DividaFieldErrors {
  const total = parseDecimalInput(montoTotal);
  const interest = parseDecimalInput(tasaInteres);
  const monthlyPayment = parseDecimalInput(cuotaMensual);
  const nextFieldErrors: DividaFieldErrors = {};

  if (!nome.trim()) {
    nextFieldErrors.nome = 'Informe um nome para a divida.';
  }

  if (!Number.isFinite(total) || total <= 0) {
    nextFieldErrors.montoTotal = 'Informe um valor total valido maior que zero.';
  }

  if (!fechaInicio.trim()) {
    nextFieldErrors.fechaInicio = 'Informe a data de inicio.';
  } else if (!isValidDateInput(fechaInicio.trim())) {
    nextFieldErrors.fechaInicio = 'Use o formato YYYY-MM-DD. Ex.: 2026-04-07.';
  }

  if (!fechaVencimiento.trim()) {
    nextFieldErrors.fechaVencimiento = 'Informe a data de vencimento.';
  } else if (!isValidDateInput(fechaVencimiento.trim())) {
    nextFieldErrors.fechaVencimiento =
      'Use o formato YYYY-MM-DD. Ex.: 2027-04-07.';
  }

  if (
    isValidDateInput(fechaInicio.trim()) &&
    isValidDateInput(fechaVencimiento.trim()) &&
    fechaVencimiento < fechaInicio
  ) {
    nextFieldErrors.fechaVencimiento =
      'A data de vencimento deve ser igual ou posterior a data de inicio.';
  }

  if (tasaInteres.trim() && !Number.isFinite(interest)) {
    nextFieldErrors.tasaInteres =
      'Informe uma taxa de interesse valida. Ex.: 2,5';
  }

  if (cuotaMensual.trim() && !Number.isFinite(monthlyPayment)) {
    nextFieldErrors.cuotaMensual =
      'Informe uma cuota mensal valida. Ex.: 450,00';
  }

  if (
    proximoVencimiento.trim() &&
    !isValidDateInput(proximoVencimiento.trim())
  ) {
    nextFieldErrors.proximoVencimiento =
      'Use o formato YYYY-MM-DD. Ex.: 2026-05-07.';
  }

  return nextFieldErrors;
}
