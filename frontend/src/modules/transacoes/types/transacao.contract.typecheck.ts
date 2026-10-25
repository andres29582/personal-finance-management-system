import type {
  CreateTransacaoRequestDto,
  UpdateTransacaoRequestDto,
} from './transacao';

type Expect<T extends true> = T;

export type UpdateExcludesAdjustment = Expect<
  'ehAjuste' extends keyof UpdateTransacaoRequestDto ? false : true
>;
export type CreatePreservesOptionalAdjustment = Expect<
  { ehAjuste?: boolean } extends Pick<CreateTransacaoRequestDto, 'ehAjuste'>
    ? true
    : false
>;
export type CreateAdjustmentRemainsBoolean = Expect<
  CreateTransacaoRequestDto['ehAjuste'] extends boolean | undefined ? true : false
>;
export type UpdatePreservesNullableDescription = Expect<
  null extends UpdateTransacaoRequestDto['descricao'] ? true : false
>;
