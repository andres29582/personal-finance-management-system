import { CreatePagoDividaRequestDto } from '../types/pago-divida';
import { PagoDividaFormValues } from '../validators/pagoDividaForm';

export function buildPagoDividaPayload(
  values: PagoDividaFormValues,
  parsedValor: number,
): CreatePagoDividaRequestDto {
  return {
    categoriaId: values.categoriaId,
    contaId: values.contaId,
    data: values.data,
    descricao: values.descricao.trim() || undefined,
    dividaId: values.dividaId ?? '',
    valor: parsedValor,
  };
}
