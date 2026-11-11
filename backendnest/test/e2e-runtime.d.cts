export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};
export type DatabaseConnection = {
  query(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};
export type Lease = Omit<DatabaseConfig, 'password'> & {
  token: string;
  pid: number;
  backendStart: string;
};
export function resolveConfig(env?: NodeJS.ProcessEnv): DatabaseConfig;
export function configureEnvironment(
  config: DatabaseConfig,
  env?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv;
export function readLease(
  config: DatabaseConfig,
  env?: NodeJS.ProcessEnv,
): Lease;
export function assertLease(
  client: DatabaseConnection,
  config: DatabaseConfig,
  env?: NodeJS.ProcessEnv,
): Promise<Lease>;
export function withGuardedDatabase<T>(
  config: DatabaseConfig,
  env: NodeJS.ProcessEnv,
  callback: (client: DatabaseConnection) => Promise<T>,
): Promise<T>;
export function combine(
  primary: unknown,
  cleanup: unknown[],
  message?: string,
): unknown;
