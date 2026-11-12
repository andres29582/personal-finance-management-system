// Types for the maintained CommonJS harness boundary. Validators accept unknown
// deliberately: negative fixtures must reach the real runtime assertions.
export interface ContractDatabase {
  query(sql: string, args?: unknown[]): Promise<{ rows: unknown[] }>;
}
export interface ClockAnchor {
  now: string;
  now_us: string;
}
export interface HarnessRuntime {
  policy: { idleSeconds: number; absoluteSeconds: number; version: number };
  throttle: { limit: number; ttl: number };
  token: {
    issuer: string;
    algorithm: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    maxActiveSessions: number;
  };
}
export interface ContractProof {
  kind: 'live-contract-preflight-not-scenario-pass';
  anchor: ClockAnchor;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>;
  constraints: unknown[];
  timezoneComparisons: unknown[];
  rejected: Array<{ assignment: string; code: string }>;
  acceptedIdleBounds: number[];
  revokedLegacyNullShapeAccepted: true;
  runtime: HarnessRuntime;
}
export const COLUMNS: Record<string, [string, string]>;
export const BACKDATE_SQL: string;
export function instantMicros(value: string): bigint;
export function epoch(expression: string): string;
export function identity(db: ContractDatabase): Promise<void>;
export function clock(db: ContractDatabase): Promise<ClockAnchor>;
export function initializeAuthority(
  db: ContractDatabase,
  check?: () => void | Promise<void>,
): Promise<ClockAnchor>;
export function assertSchema(columns: unknown): void;
export function assertRuntime(runtime: unknown): void;
export function assertFixture(row: unknown): void;
export function authority(db: ContractDatabase): Promise<{
  raw: Record<string, unknown>[];
  instants: Record<string, unknown>[];
}>;
export function preflight(
  db: ContractDatabase,
  runtime: HarnessRuntime,
): Promise<ContractProof>;
