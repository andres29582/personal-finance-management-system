import { parseDecimalInput } from '../../../../utils/number-input';
import { isValidDateInput } from '../../../shared/validators/dateInput';

export type PagoDividaFormValues = {
  categoriaId: string;
  contaId: string;
  data: string;
  descricao: string;
  dividaId?: string;
  valor: string;
};

export type PaymentFieldErrors = Partial<Record<"contaId" | "categoriaId" | "valor" | "data", string>>;

export type PagoDividaFormValidationResult =
  | { valid: true; parsedValor: number }
  | { valid: false; message: string; fieldErrors: PaymentFieldErrors };

export function validatePagoDividaForm(
  values: PagoDividaFormValues,
): PagoDividaFormValidationResult {
  const parsedValor = parseDecimalInput(values.valor);
  const fieldErrors: PaymentFieldErrors = {};
  if (!values.contaId) fieldErrors.contaId = "Selecione a conta do pagamento.";
  if (!values.categoriaId) fieldErrors.categoriaId = "Selecione a categoria do pagamento.";
  if (!values.valor.trim() || !Number.isFinite(parsedValor)) fieldErrors.valor = "Informe um valor valido para o pagamento.";
  if (!values.data.trim()) fieldErrors.data = "Informe a data do pagamento.";

  if (
    !values.dividaId ||
    !values.contaId ||
    !values.categoriaId ||
    !values.valor.trim() ||
    !values.data.trim() ||
    !Number.isFinite(parsedValor)
  ) {
    return { valid: false, message: 'Preencha conta, categoria, valor e data.', fieldErrors };
  }

  if (parsedValor <= 0) {
    return { valid: false, message: 'O valor deve ser maior que zero.', fieldErrors: { valor: 'O valor deve ser maior que zero.' } };
  }

  if (!isValidDateInput(values.data.trim())) {
    return {
      valid: false,
      message: 'Informe uma data valida no formato YYYY-MM-DD.',
      fieldErrors: { data: 'Data do pagamento invalida. Use YYYY-MM-DD.' },
    };
  }

  return { valid: true, parsedValor };
}
