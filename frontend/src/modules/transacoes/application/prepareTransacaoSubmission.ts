import type {
  CreateTransacaoRequestDto,
  TipoTransacao,
  UpdateTransacaoRequestDto,
} from "../types/transacao";

export type TransacaoSubmissionInput = {
  contaId: string;
  categoriaId: string;
  tipo: TipoTransacao;
  parsedValor: number;
  normalizedData: string | null;
  descricao: string;
};

export type ValidatedTransacaoSubmissionInput = Omit<
  TransacaoSubmissionInput,
  "normalizedData"
> & { normalizedData: string };

export type TransacaoSubmissionValidation =
  | { ok: false; message: string }
  | { ok: true; value: ValidatedTransacaoSubmissionInput };

export type TransacaoSubmissionCommand =
  | { operation: "create" }
  | { operation: "update"; id: string };

export type PreparedTransacaoSubmission =
  | { operation: "create"; payload: CreateTransacaoRequestDto }
  | { operation: "update"; id: string; payload: UpdateTransacaoRequestDto };

export function validateTransacaoSubmission(
  input: TransacaoSubmissionInput,
): TransacaoSubmissionValidation {
  if (!input.contaId) {
    return { ok: false, message: "Selecione uma conta para continuar." };
  }
  if (!Number.isFinite(input.parsedValor)) {
    return { ok: false, message: "Informe um valor valido. Ex.: 150,90" };
  }
  if (input.parsedValor <= 0) {
    return { ok: false, message: "O valor deve ser maior que zero." };
  }
  if (!input.categoriaId) {
    return { ok: false, message: "Selecione uma categoria para continuar." };
  }
  if (!input.normalizedData) {
    return {
      ok: false,
      message: "Informe uma data valida no formato DD/MM/AAAA. Ex.: 07/04/2026",
    };
  }
  return {
    ok: true,
    value: { ...input, normalizedData: input.normalizedData },
  };
}

export function prepareTransacaoSubmission(
  input: ValidatedTransacaoSubmissionInput,
  command: TransacaoSubmissionCommand,
): PreparedTransacaoSubmission {
  const payload = {
    contaId: input.contaId,
    categoriaId: input.categoriaId,
    data: input.normalizedData,
    tipo: input.tipo,
    valor: input.parsedValor,
  };

  if (command.operation === "update") {
    return {
      operation: "update",
      id: command.id,
      payload: { ...payload, descricao: input.descricao.trim() || null },
    };
  }
  return {
    operation: "create",
    payload: { ...payload, descricao: input.descricao.trim() || undefined },
  };
}
