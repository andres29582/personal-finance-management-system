import assert from 'node:assert/strict';

/** Network and JSON decoder boundary for harnesses; reject malformed shapes. */
export function objectValue(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected JSON object',
  );
  return value as Record<string, unknown>;
}
export function jsonObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  return objectValue(value);
}
export function stringValue(value: unknown): string {
  assert.equal(typeof value, 'string', 'Expected string');
  return value as string;
}
export function numberValue(value: unknown): number {
  assert.ok(
    typeof value === 'number' && Number.isFinite(value),
    'Expected finite number',
  );
  return value;
}
export function statsValue(value: unknown): Record<string, number> {
  const record = objectValue(value);
  return Object.fromEntries(
    Object.entries(record).map(([key, count]) => [key, numberValue(count)]),
  );
}
export async function sqlRows(
  db: { query(sql: string, args?: unknown[]): Promise<unknown> },
  sql: string,
  args?: unknown[],
): Promise<Record<string, unknown>[]> {
  const value = await db.query(sql, args);
  assert.ok(Array.isArray(value), 'Expected SQL row array');
  return value.map(objectValue);
}
