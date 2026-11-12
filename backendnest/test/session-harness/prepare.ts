import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { prepareE2eDatabase } from '../e2e-database';
import { configureEnvironment, readLease } from '../e2e-runtime.cjs';
import { resolveSessionPolicy } from '../../src/auth/session-policy';
import { resolveAuthTokenConfig } from '../../src/auth/config/auth-token.config';
import { resolveThrottlerConfig } from '../../src/config/throttler.config';
import { preflight, initializeAuthority } from './contract.cjs';

async function prepare() {
  // Do not use configureE2eEnvironment: its general E2E throttle profile is 1000.
  const config = {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  };
  readLease(config);
  configureEnvironment(config);
  await prepareE2eDatabase(config);
  const db = new DataSource({
    type: 'postgres',
    ...config,
    connectTimeoutMS: 5000,
  });
  await db.initialize();
  const connection = db.createQueryRunner();
  await connection.connect();
  try {
    const query = {
      query: async (
        sql: string,
        args?: unknown[],
      ): Promise<{ rows: unknown[] }> => {
        const rows: unknown = await connection.query(sql, args);
        if (!Array.isArray(rows)) throw new Error('Expected SQL row array');
        return { rows };
      },
    };
    const reader = { get: (key: string) => process.env[key] } as Parameters<
      typeof resolveSessionPolicy
    >[0];
    const resolvedToken = resolveAuthTokenConfig(reader);
    const token = {
      issuer: resolvedToken.issuer,
      algorithm: resolvedToken.algorithm,
      accessExpiresIn: resolvedToken.accessExpiresIn,
      refreshExpiresIn: resolvedToken.refreshExpiresIn,
      maxActiveSessions: resolvedToken.maxActiveSessions,
    };
    const contract = await preflight(query, {
      policy: resolveSessionPolicy(reader),
      throttle: resolveThrottlerConfig(reader),
      token,
    });
    writeFileSync(
      join(process.env.SESSION_HARNESS_ARTIFACTS!, 'contract-proof.json'),
      JSON.stringify(contract, null, 2),
      { flag: 'wx' },
    );
    await initializeAuthority(query);
    const hash = await bcrypt.hash('U4-disposable-password-42!', 10);
    for (let i = 1; i <= 6; i++)
      await connection.query(
        'INSERT INTO usuario(id,nome,email,senha_hash) VALUES($1::uuid,$2::text,$3::text,$4::text)',
        [
          randomUUID(),
          `Current session fixture ${i}`,
          `current-${i}@example.com`,
          hash,
        ],
      );
    console.log(
      JSON.stringify({
        prepared: true,
        users: 6,
        contract: contract.kind,
        timezone: 'UTC',
        throttle: contract.runtime.throttle,
      }),
    );
  } finally {
    await connection.release();
    await db.destroy();
  }
}
void prepare().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Preparation failed.');
  process.exitCode = 1;
});
