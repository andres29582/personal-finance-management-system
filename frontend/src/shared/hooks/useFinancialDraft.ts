import { useEffect, useRef, useState } from "react";
import {
  clearFinancialDraft,
  DraftOwner,
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

export function useFinancialDraft<T extends object>(key: string, initial: T) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const scope = useRef(key);
  const owner = useRef(getFinancialDraftOwner()).current;
  const restored = useRef(readFinancialDraft<T>(key));
  const current = useRef(restored.current?.fields ?? initial);
  const record = useRef(restored.current);
  const edits = useRef(0);
  const hydrated = useRef(Boolean(restored.current));
  const [fields, setFields] = useState(current.current);
  if (scope.current !== key) {
    scope.current = key;
    restored.current = readFinancialDraft<T>(key);
    current.current = restored.current?.fields ?? initial;
    record.current = restored.current;
    edits.current = 0;
    hydrated.current = Boolean(restored.current);
    setFields(current.current);
  }
  const active = () =>
    mounted.current && scope.current === key &&
    (!owner || readFinancialDraft<T>(key)?.version === record.current?.version) &&
    (!owner ||
      JSON.stringify(getFinancialDraftOwner()) === JSON.stringify(owner));

  function setField<K extends keyof T>(field: K, value: T[K] | ((previous: T[K]) => T[K])) {
    if (!active()) return;
    const nextValue = typeof value === "function" ? (value as (previous: T[K]) => T[K])(current.current[field]) : value;
    current.current = { ...current.current, [field]: nextValue };
    edits.current++;
    hydrated.current = true;
    if (owner)
      record.current = writeFinancialDraft(key, owner, current.current);
    setFields(current.current);
  }
  function hydrate(values: Partial<T>) {
    if (!active() || hydrated.current) return;
    current.current = { ...current.current, ...values };
    hydrated.current = true;
    setFields(current.current);
  }
  function capture(): Capture {
    return {
      key,
      owner,
      edits: edits.current,
      version: record.current?.version,
    };
  }
  function isCurrent(expected = capture()) {
    return active() && expected.key === key && expected.edits === edits.current &&
      expected.owner === owner && expected.version === record.current?.version;
  }
  function clear(expected = capture()) {
    if (!isCurrent(expected)) return;
    if (owner && expected.version !== undefined)
      clearFinancialDraft(key, owner, expected.version);
    record.current = null;
    edits.current++;
  }
  return {
    fields: active() ? fields : initial,
    setField,
    hydrate,
    capture,
    isCurrent,
    clear,
    restored: Boolean(restored.current),
  };
}
