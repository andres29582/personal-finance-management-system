const {
  initializeAuthority,
  assertSchema,
  assertRuntime,
  assertFixture,
  instantMicros,
  COLUMNS,
  BACKDATE_SQL,
} = require('./contract.cjs');

describe('current session harness contract (offline, not scenario proof)', () => {
  test('source guard declares one finite 120-second startup budget for every profile', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(__dirname, 'runner.cjs'),
      'utf8',
    );
    expect(source).toMatch(/startupMs: 120000,/);
    expect(source).toContain(
      "() => reject(Error('Backend readiness timeout'))",
    );
    expect(source).toContain('proof.limits.startupMs,');
    expect(source).toContain('Date.now() - began <= proof.limits.startupMs');
  });
  const columns = () =>
    Object.entries(COLUMNS as Record<string, [string, string]>).map(
      ([column_name, [data_type, is_nullable]]) => ({
        column_name,
        data_type,
        is_nullable,
      }),
    );
  const runtime = () => ({
    policy: { idleSeconds: 900, absoluteSeconds: 43200, version: 1 },
    throttle: { limit: 60, ttl: 60000 },
    token: {
      issuer: 'meu-sistema-financeiro',
      algorithm: 'HS256',
      accessExpiresIn: '15m',
      refreshExpiresIn: '30d',
      maxActiveSessions: 5,
    },
  });
  const fixture = () => ({
    policy_version: 1,
    idle_timeout_seconds: 900,
    authenticated_us: '1000001',
    absolute_us: '43201000001',
    activity_us: '2000001',
    refresh_us: '43201000001',
    expires_us: '43201000001',
  });
  test('sets and asserts UTC/DB clock before admitting writes', async () => {
    const calls: string[] = [];
    const db = {
      query: async (sql: string) => {
        calls.push(sql);
        return {
          rows: sql.startsWith('SHOW')
            ? [{ TimeZone: 'UTC' }]
            : [
                {
                  now: '2026-10-11 17:00:00.000001+00',
                  now_us: '1791738000000001',
                },
              ],
        };
      },
    };
    const clock = await initializeAuthority(db, async () => {
      calls.push('identity');
    });
    expect(calls[0]).toBe('identity');
    expect(calls[1]).toBe("SET TIME ZONE 'UTC'");
    expect(calls[2]).toBe('SHOW TIME ZONE');
    expect(clock.now_us).toBe('1791738000000001');
  });
  test('refuses a non-UTC connection even after SET', async () => {
    await expect(
      initializeAuthority(
        { query: async () => ({ rows: [{ TimeZone: 'America/Sao_Paulo' }] }) },
        async () => {},
      ),
    ).rejects.toThrow();
  });
  test('accepts exact schema', () =>
    expect(() => assertSchema(columns())).not.toThrow());
  test.each(['usuario_id', 'expires_at', 'refresh_expires_at'])(
    'rejects missing column %s',
    (name) =>
      expect(() =>
        assertSchema(columns().filter((x) => x.column_name !== name)),
      ).toThrow(),
  );
  test('rejects wrong timestamp type', () => {
    const c = columns();
    c.find((x) => x.column_name === 'expires_at')!.data_type =
      'timestamp with time zone';
    expect(() => assertSchema(c)).toThrow();
  });
  test('rejects relaxed required nullability', () => {
    const c = columns();
    c.find((x) => x.column_name === 'usuario_id')!.is_nullable = 'YES';
    expect(() => assertSchema(c)).toThrow();
  });
  test('rejects tightening migration-compatible nullable policy fields', () => {
    const c = columns();
    c.find((x) => x.column_name === 'authenticated_at')!.is_nullable = 'NO';
    expect(() => assertSchema(c)).toThrow();
  });
  test('accepts default runtime but not general E2E throttle 1000', () => {
    expect(() => assertRuntime(runtime())).not.toThrow();
    const r = runtime();
    r.throttle.limit = 1000;
    expect(() => assertRuntime(r)).toThrow();
  });
  test.each([0, 901, 31536001])(
    'rejects changed resolved idle policy %s',
    (idle) => {
      const r = runtime();
      r.policy.idleSeconds = idle;
      expect(() => assertRuntime(r)).toThrow();
    },
  );
  test('rejects changed issuer and unsupported version', () => {
    const r = runtime();
    r.token.issuer = 'other';
    expect(() => assertRuntime(r)).toThrow();
    r.token.issuer = 'meu-sistema-financeiro';
    r.policy.version = 2;
    expect(() => assertRuntime(r)).toThrow();
  });
  test('preserves microseconds rather than JS millisecond equality', () => {
    expect(instantMicros('1000001')).not.toBe(instantMicros('1000002'));
    expect(() => instantMicros('2026-10-11 17:00:00')).toThrow();
  });
  test('uses typed instants, not timestamp/timestamptz raw string equality', () => {
    const f = {
      ...fixture(),
      expires_at: '2026-10-12 05:00:00.000001',
      refresh_expires_at: '2026-10-12 05:00:00.000001+00',
    };
    expect(() => assertFixture(f)).not.toThrow();
  });
  test.each(['absolute_us', 'activity_us', 'refresh_us', 'expires_us'])(
    'rejects illegal deadline %s',
    (key) => {
      const f = fixture();
      (f as any)[key] = key === 'absolute_us' ? '43201000002' : '43201000002';
      expect(() => assertFixture(f)).toThrow();
    },
  );
  test('backdates legacy timestamp only via explicit owned UTC conversion', () => {
    expect(BACKDATE_SQL).toContain("AT TIME ZONE 'UTC'");
    expect(BACKDATE_SQL).toContain('$1::uuid');
    expect(BACKDATE_SQL).toContain('$6::uuid');
    expect(BACKDATE_SQL).toContain('$5::boolean');
  });
});
