import { useLayoutEffect, useRef, useState } from "react";
import {
  clearFinancialDraft,
  DraftOwner,
  FinancialDraft,
  getFinancialDraftOwner,
  readFinancialDraft,
  writeFinancialDraft,
} from "../../../storage/financialDrafts";

type Capture = {
  key: string;
  version?: number;
  edits: number;
  owner: DraftOwner | null;
};
type DraftState<T> = {
  key: string;
  scope: object;
  owner: DraftOwner | null;
  record: FinancialDraft<T> | null;
  fields: T;
  edits: number;
  hydrated: boolean;
  restored: boolean;
};
function initialDraftState<T>(key: string, initial: T): DraftState<T> {
  const owner = getFinancialDraftOwner();
  const record = readFinancialDraft<T>(key);
  return {
    key,
    scope: {},
    owner,
    record,
    fields: record?.fields ?? initial,
    edits: 0,
    hydrated: Boolean(record),
    restored: Boolean(record),
  };
}
export function useFinancialDraft<T extends object>(key: string, initial: T) {
  const [state, setState] = useState(() => initialDraftState(key, initial));
  const committed = useRef(state);
  const mounted = useRef(true);
  // React retries this render with the new scope before committing children.
  if (state.key !== key) setState(initialDraftState(key, initial));
  useLayoutEffect(() => {
    committed.current = state;
  }, [state]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function active() {
    const current = committed.current;
    return (
      mounted.current &&
      current.key === key &&
      current.scope === state.scope &&
      (!current.owner ||
        readFinancialDraft<T>(key)?.version === current.record?.version) &&
      (!current.owner ||
        JSON.stringify(getFinancialDraftOwner()) ===
          JSON.stringify(current.owner))
    );
  }
  function publish(next: DraftState<T>) {
    // Event handlers and promise continuations observe the write immediately.
    committed.current = next;
    setState(next);
  }
  function setField<K extends keyof T>(
    field: K,
    value: T[K] | ((previous: T[K]) => T[K]),
  ) {
    if (!active()) return;
    const current = committed.current;
    const nextValue =
      typeof value === "function"
        ? (value as (previous: T[K]) => T[K])(current.fields[field])
        : value;
    const fields = { ...current.fields, [field]: nextValue };
    publish({
      ...current,
      fields,
      edits: current.edits + 1,
      hydrated: true,
      record: current.owner
        ? writeFinancialDraft(key, current.owner, fields)
        : null,
    });
  }
  function hydrate(values: Partial<T>) {
    if (!active() || committed.current.hydrated) return;
    const current = committed.current;
    publish({
      ...current,
      fields: { ...current.fields, ...values },
      hydrated: true,
    });
  }
  function capture(): Capture {
    const current = committed.current;
    return {
      key,
      owner: current.owner,
      edits: current.edits,
      version: current.record?.version,
    };
  }
  function isCurrent(expected = capture()) {
    const current = committed.current;
    return (
      active() &&
      expected.key === key &&
      expected.edits === current.edits &&
      expected.owner === current.owner &&
      expected.version === current.record?.version
    );
  }
  function clear(expected = capture()) {
    if (!isCurrent(expected)) return;
    const current = committed.current;
    if (current.owner && expected.version !== undefined)
      clearFinancialDraft(key, current.owner, expected.version);
    publish({ ...current, record: null, edits: current.edits + 1 });
  }
  const visible =
    state.key === key &&
    (!state.owner ||
      (JSON.stringify(getFinancialDraftOwner()) ===
        JSON.stringify(state.owner) &&
        readFinancialDraft<T>(key)?.version === state.record?.version));
  return {
    fields: visible ? state.fields : initial,
    setField,
    hydrate,
    capture,
    isCurrent,
    clear,
    restored: state.restored,
  };
}
