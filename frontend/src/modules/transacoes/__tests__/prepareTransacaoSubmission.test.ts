import {
  prepareTransacaoSubmission,
  validateTransacaoSubmission,
  type TransacaoSubmissionInput,
  type ValidatedTransacaoSubmissionInput,
} from "../application/prepareTransacaoSubmission";

const values: TransacaoSubmissionInput = {
  contaId: "account-1",
  categoriaId: "category-1",
  tipo: "despesa",
  parsedValor: 100,
  normalizedData: "2026-10-26",
  descricao: "  Compra  ",
};

function validatedValues(
  changes: Partial<TransacaoSubmissionInput> = {},
): ValidatedTransacaoSubmissionInput {
  const result = validateTransacaoSubmission({ ...values, ...changes });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe("prepareTransacaoSubmission", () => {
  it("prepares the existing create payload without adjustment fields", () => {
    expect(
      prepareTransacaoSubmission(validatedValues(), { operation: "create" }),
    ).toEqual({
      operation: "create",
      payload: {
        contaId: "account-1",
        categoriaId: "category-1",
        tipo: "despesa",
        valor: 100,
        data: "2026-10-26",
        descricao: "Compra",
      },
    });
  });

  it("corrects an existing expense from 100 to 86 without creating an adjustment", () => {
    expect(
      prepareTransacaoSubmission(validatedValues({ parsedValor: 86 }), {
        operation: "update",
        id: "transaction-1",
      }),
    ).toEqual({
      operation: "update",
      id: "transaction-1",
      payload: {
        contaId: "account-1",
        categoriaId: "category-1",
        tipo: "despesa",
        valor: 86,
        data: "2026-10-26",
        descricao: "Compra",
      },
    });
  });

  it("preserves an undefined description on create", () => {
    const result = prepareTransacaoSubmission(
      validatedValues({ descricao: "   " }),
      { operation: "create" },
    );
    expect(result.operation).toBe("create");
    expect(result.payload.descricao).toBeUndefined();
    expect(result.payload).toHaveProperty("descricao");
  });

  it("clears a blank description with null on update", () => {
    expect(
      prepareTransacaoSubmission(validatedValues({ descricao: "   " }), {
        operation: "update",
        id: "transaction-1",
      }),
    ).toMatchObject({
      operation: "update",
      id: "transaction-1",
      payload: { descricao: null },
    });
  });

  it("preserves the selected income nature and category", () => {
    expect(
      prepareTransacaoSubmission(
        validatedValues({ tipo: "receita", categoriaId: "income-category" }),
        { operation: "create" },
      ),
    ).toMatchObject({
      payload: { tipo: "receita", categoriaId: "income-category" },
    });
  });

  it("preserves the selected historical category on update", () => {
    expect(
      prepareTransacaoSubmission(
        validatedValues({ categoriaId: "inactive-category" }),
        { operation: "update", id: "transaction-1" },
      ),
    ).toMatchObject({ payload: { categoriaId: "inactive-category" } });
  });

  it.each<{ changes: Partial<TransacaoSubmissionInput>; message: string }>([
    {
      changes: { contaId: "" },
      message: "Selecione uma conta para continuar.",
    },
    {
      changes: { parsedValor: Number.NaN },
      message: "Informe um valor valido. Ex.: 150,90",
    },
    {
      changes: { parsedValor: Number.POSITIVE_INFINITY },
      message: "Informe um valor valido. Ex.: 150,90",
    },
    {
      changes: { parsedValor: Number.NEGATIVE_INFINITY },
      message: "Informe um valor valido. Ex.: 150,90",
    },
    {
      changes: { parsedValor: 0 },
      message: "O valor deve ser maior que zero.",
    },
    {
      changes: { parsedValor: -1 },
      message: "O valor deve ser maior que zero.",
    },
    {
      changes: { categoriaId: "" },
      message: "Selecione uma categoria para continuar.",
    },
    {
      changes: { normalizedData: null },
      message: "Informe uma data valida no formato DD/MM/AAAA. Ex.: 07/04/2026",
    },
    {
      changes: { normalizedData: "" },
      message: "Informe uma data valida no formato DD/MM/AAAA. Ex.: 07/04/2026",
    },
  ])(
    "keeps the existing validation message for $changes",
    ({ changes, message }) => {
      expect(validateTransacaoSubmission({ ...values, ...changes })).toEqual({
        ok: false,
        message,
      });
    },
  );

  it.each<{ changes: Partial<TransacaoSubmissionInput>; message: string }>([
    {
      changes: {
        contaId: "",
        parsedValor: Number.NaN,
        categoriaId: "",
        normalizedData: null,
      },
      message: "Selecione uma conta para continuar.",
    },
    {
      changes: {
        parsedValor: Number.NaN,
        categoriaId: "",
        normalizedData: null,
      },
      message: "Informe um valor valido. Ex.: 150,90",
    },
    {
      changes: { parsedValor: 0, categoriaId: "", normalizedData: null },
      message: "O valor deve ser maior que zero.",
    },
    {
      changes: { categoriaId: "", normalizedData: null },
      message: "Selecione uma categoria para continuar.",
    },
  ])("preserves validation precedence for $changes", ({ changes, message }) => {
    expect(validateTransacaoSubmission({ ...values, ...changes })).toEqual({
      ok: false,
      message,
    });
  });

  it("does not mutate the supplied values or command", () => {
    const input = validatedValues();
    const command = {
      operation: "update",
      id: "transaction-1",
    } satisfies Parameters<typeof prepareTransacaoSubmission>[1];
    prepareTransacaoSubmission(input, command);
    expect(input).toEqual(values);
    expect(command).toEqual({ operation: "update", id: "transaction-1" });
  });

  it("leaves description normalization to preparation after validation", () => {
    const input = validatedValues({ descricao: "  Compra  " });
    expect(input.descricao).toBe("  Compra  ");
    expect(
      prepareTransacaoSubmission(input, { operation: "create" }).payload
        .descricao,
    ).toBe("Compra");
  });
});
