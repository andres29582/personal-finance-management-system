import { getSessionAuthority } from "../../src/modules/auth/services/sessionAuthority";
import {
  getSessionGeneration,
  isLocallySignedOut,
} from "../../storage/authStorage";
import {
  clearFinancialDraft,
  getFinancialDraftOwner,
  readFinancialDraft,
  writeFinancialDraft,
} from "../../storage/financialDrafts";

jest.mock("../../src/modules/auth/services/sessionAuthority", () => ({
  getSessionAuthority: jest.fn(),
  subscribeSessionAuthority: jest.fn(() => () => {}),
}));
jest.mock("../../storage/authStorage", () => ({
  getSessionGeneration: jest.fn(),
  isLocallySignedOut: jest.fn(),
  subscribeAuthState: jest.fn(() => () => {}),
}));

const authority = getSessionAuthority as jest.Mock;
const generation = getSessionGeneration as jest.Mock;
const signedOut = isLocallySignedOut as jest.Mock;
function confirm(id = "session", gen = 1) {
  generation.mockReturnValue(gen);
  signedOut.mockReturnValue(false);
  authority.mockReturnValue({
    snapshot: {
      incarnation: "owner",
      sessionId: id,
      generation: gen,
      accessToken: "must-not-store",
      revision: 1,
    },
  });
}
beforeEach(() => {
  signedOut.mockReturnValue(true);
  readFinancialDraft("transfer/new");
  confirm();
});

it("retains only same-session memory across suspension and token rotation", () => {
  const owner = getFinancialDraftOwner()!;
  writeFinancialDraft("transfer/new", owner, {
    valor: "100",
    intent: { key: "stable", payload: { valor: 100 } },
  });
  authority.mockReturnValue(null);
  expect(readFinancialDraft("transfer/new")).toBeNull();
  confirm();
  authority.mockReturnValue({
    snapshot: { ...owner, accessToken: "rotated", revision: 2 },
  });
  expect(readFinancialDraft<any>("transfer/new")?.fields.intent.key).toBe(
    "stable",
  );
  expect(JSON.stringify(readFinancialDraft("transfer/new"))).not.toContain(
    "rotated",
  );
});

it.each(["logout", "generation", "identity"])(
  "purges on %s without depending on listener order",
  (reason) => {
    const owner = getFinancialDraftOwner()!;
    writeFinancialDraft("transfer/new", owner, { valor: "100" });
    if (reason === "logout") signedOut.mockReturnValue(true);
    if (reason === "generation") generation.mockReturnValue(2);
    if (reason === "identity") confirm("other");
    expect(readFinancialDraft("transfer/new")).toBeNull();
    expect(
      writeFinancialDraft("transfer/new", owner, { valor: "late" }),
    ).toBeNull();
  },
);

it("separates routes/entities and rejects stale completion clears", () => {
  const owner = getFinancialDraftOwner()!;
  const first = writeFinancialDraft("transfer/new", owner, { valor: "100" })!;
  const second = writeFinancialDraft("transfer/new", owner, { valor: "200" })!;
  writeFinancialDraft("transaction/other", owner, { valor: "300" });
  clearFinancialDraft("transfer/new", owner, first.version);
  expect(readFinancialDraft<any>("transfer/new")?.fields.valor).toBe("200");
  clearFinancialDraft("transfer/new", owner, second.version);
  expect(readFinancialDraft("transfer/new")).toBeNull();
  expect(readFinancialDraft<any>("transaction/other")?.fields.valor).toBe(
    "300",
  );
});
