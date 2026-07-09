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

export type PagoDividaFormValidationResult =
  | { valid: true; parsedValor: number }
  | { valid: false; message: string };

export function validatePagoDividaForm(
  values: PagoDividaFormValues,
): PagoDividaFormValidationResult {
  const parsedValor = parseDecimalInput(values.valor);

  if (
    !values.dividaId ||
    !values.contaId ||
    !values.categoriaId ||
    !values.valor.trim() ||
    !values.data.trim() ||
    !Number.isFinite(parsedValor)
  ) {
    return { valid: false, message: 'Preencha conta, categoria, valor e data.' };
  }

  if (parsedValor <= 0) {
    return { valid: false, message: 'O valor deve ser maior que zero.' };
  }

  if (!isValidDateInput(values.data.trim())) {
    return {
      valid: false,
      message: 'Informe uma data valida no formato YYYY-MM-DD.',
    };
  }

  return { valid: true, parsedValor };
}
