import { act, renderHook } from "@testing-library/react-native";
import { useFinancialDraft } from "../../src/shared/hooks/useFinancialDraft";
import { getSessionAuthority } from "../../src/modules/auth/services/sessionAuthority";
import { isLocallySignedOut } from "../../storage/authStorage";
import { readFinancialDraft } from "../../storage/financialDrafts";
jest.mock("../../storage/authStorage", () => ({
  getSessionGeneration: () => 1,
  isLocallySignedOut: jest.fn(),
  subscribeAuthState: () => () => {},
}));
jest.mock("../../src/modules/auth/services/sessionAuthority", () => ({
  getSessionAuthority: jest.fn(),
  subscribeSessionAuthority: () => () => {},
}));
beforeEach(() => {
  jest.mocked(isLocallySignedOut).mockReturnValue(true);
  readFinancialDraft("hook");
  jest.mocked(isLocallySignedOut).mockReturnValue(false);
  jest.mocked(getSessionAuthority).mockReturnValue({
    snapshot: { incarnation: "A", sessionId: "session", generation: 1 },
  } as never);
});
it("rejects a same-owner stale writer after a newer instance changes the store version", () => {
  const first = renderHook(() => useFinancialDraft("hook", { valor: "" }));
  act(() => first.result.current.setField("valor", "100"));
  const next = renderHook(() => useFinancialDraft("hook", { valor: "" }));
  act(() => next.result.current.setField("valor", "200"));
  act(() => first.result.current.setField("valor", "300"));
  expect(readFinancialDraft<{ valor: string }>("hook")?.fields.valor).toBe(
    "200",
  );
});
it("rejects setters and captures from a previous route scope and after unmount", () => {
  const hook = renderHook<
    ReturnType<typeof useFinancialDraft<{ valor: string }>>,
    { scope: string }
  >(({ scope }) => useFinancialDraft(scope, { valor: "" }), {
    initialProps: { scope: "hook" },
  });
  const previous = hook.result.current;
  hook.rerender({ scope: "hook/other" });
  act(() => previous.setField("valor", "obsolete"));
  expect(readFinancialDraft("hook")).toBeNull();
  expect(previous.isCurrent(previous.capture())).toBe(false);
  const setter = hook.result.current.setField;
  hook.unmount();
  act(() => setter("valor", "unmounted"));
  expect(readFinancialDraft("hook/other")).toBeNull();
});

it("does not revive an old setter when the route returns to the same key", () => {
  const hook = renderHook<ReturnType<typeof useFinancialDraft<{ valor: string }>>, { scope: string }>(
    ({ scope }) => useFinancialDraft(scope, { valor: "" }),
    {
      initialProps: { scope: "hook" },
    },
  );
  act(() => hook.result.current.setField("valor", "100"));
  const obsolete = hook.result.current;
  hook.rerender({ scope: "hook/other" });
  hook.rerender({ scope: "hook" });
  act(() => obsolete.setField("valor", "obsolete"));
  expect(hook.result.current.fields.valor).toBe("100");
  expect(obsolete.isCurrent(obsolete.capture())).toBe(false);
});

it("keeps consecutive edits and their capture coherent before React commits", () => {
  const hook = renderHook(() =>
    useFinancialDraft("hook", { valor: "", descricao: "" }),
  );
  const previousRender = hook.result.current;
  let submitted: ReturnType<typeof previousRender.capture>;
  act(() => {
    previousRender.setField("valor", "100");
    previousRender.setField("descricao", "latest");
    submitted = previousRender.capture();
  });
  expect(hook.result.current.fields).toEqual({
    valor: "100",
    descricao: "latest",
  });
  expect(hook.result.current.isCurrent(submitted!)).toBe(true);
});
