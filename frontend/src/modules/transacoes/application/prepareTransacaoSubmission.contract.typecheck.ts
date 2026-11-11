import type {
  PreparedTransacaoSubmission,
  TransacaoSubmissionCommand,
  TransacaoSubmissionInput,
  ValidatedTransacaoSubmissionInput,
} from "./prepareTransacaoSubmission";
import type {
  CreateTransacaoRequestDto,
  UpdateTransacaoRequestDto,
} from "../types/transacao";

type Expect<T extends true> = T;
type UpdateCommand = Extract<
  TransacaoSubmissionCommand,
  { operation: "update" }
>;
type PreparedCreate = Extract<
  PreparedTransacaoSubmission,
  { operation: "create" }
>;
type PreparedUpdate = Extract<
  PreparedTransacaoSubmission,
  { operation: "update" }
>;

export type UpdateRequiresId = Expect<
  { operation: "update" } extends UpdateCommand ? false : true
>;
export type UpdateCarriesId = Expect<
  PreparedUpdate["id"] extends string ? true : false
>;
export type CreateDoesNotCarryId = Expect<
  "id" extends keyof PreparedCreate ? false : true
>;
export type CreatePayloadMatchesRequest = Expect<
  PreparedCreate["payload"] extends CreateTransacaoRequestDto ? true : false
>;
export type UpdatePayloadMatchesRequest = Expect<
  PreparedUpdate["payload"] extends UpdateTransacaoRequestDto ? true : false
>;
export type UpdateCannotSetAdjustment = Expect<
  "ehAjuste" extends keyof PreparedUpdate["payload"] ? false : true
>;
export type PreparationRequiresValidatedDate = Expect<
  TransacaoSubmissionInput extends ValidatedTransacaoSubmissionInput
    ? false
    : true
>;
