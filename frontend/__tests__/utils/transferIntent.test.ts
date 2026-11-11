import {
  prepareTransferIntent,
  isUnknownTransferOutcome,
} from "../../src/modules/transferencias/utils/transferIntent";
jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  uuid: { v4: jest.fn().mockReturnValueOnce("one").mockReturnValue("two") },
}));

const payload = {
  contaOrigemId: "a",
  contaDestinoId: "b",
  valor: 100,
  comissao: 0,
  data: "2026-10-21",
};
it("retains one key and original payload across retries and refuses edited uncertain intents", () => {
  const first = prepareTransferIntent(payload, null)!;
  expect(prepareTransferIntent(payload, first)).toBe(first);
  expect(prepareTransferIntent({ ...payload, valor: 200 }, first)).toBeNull();
  expect(prepareTransferIntent(payload, null)?.key).not.toBe(first.key);
});
it.each([
  {},
  { code: "ECONNABORTED" },
  { response: { status: 503 } },
  { response: { status: 408 } },
])("classifies uncertain mutation outcome", (error) => {
  expect(isUnknownTransferOutcome(error)).toBe(true);
});
it.each([400, 401, 409, 422])(
  "does not label a confirmed %s rejection as a network result",
  (status) => {
    expect(isUnknownTransferOutcome({ response: { status } })).toBe(false);
  },
);
