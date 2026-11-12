export function summarize(
  records: Array<{ status: string | number; latencyMs: number }>,
): {
  statuses: Record<string, number>;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  samples: number;
};
export function assertHealthy(response: unknown, expected: unknown): void;
export function assertAdmission(
  sample: unknown,
  minimumWaits: number,
  otherRequired: number,
): void;
export function assertNoRenewal(
  before: unknown,
  after: unknown,
  reason: string,
): void;
