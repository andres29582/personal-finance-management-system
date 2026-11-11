import { uuid } from "expo-modules-core";
import { CreateTransferenciaRequestDto } from "../types/transferencia";

export type TransferIntent = {
  key: string;
  payload: Omit<CreateTransferenciaRequestDto, "idempotencyKey">;
};
export function prepareTransferIntent(
  payload: TransferIntent["payload"],
  previous: TransferIntent | null,
): TransferIntent | null {
  if (previous)
    return JSON.stringify(previous.payload) === JSON.stringify(payload)
      ? previous
      : null;
  return { key: uuid.v4(), payload: { ...payload } };
}
export function isUnknownTransferOutcome(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === undefined || status === 408 || status >= 500;
}
