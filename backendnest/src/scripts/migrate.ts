import { config as loadDotenv } from 'dotenv';
import { resolve, join } from 'node:path';
import { Client } from 'pg';
import { resolveDatabaseConfig } from '../config/database.config';
import {
  type QueryableClient,
  getMigrationStatus,
  markMigrationsAsApplied,
  runPendingMigrations,
} from './migration-runner';

// Load .env relative to backendnest root
const rootDir = resolve(__dirname, '..', '..');
loadDotenv({ path: join(rootDir, '.env') });

async function main(): Promise<void> {
  const command = (process.argv[2] ?? 'run').toLowerCase().trim();
  const migrationsDir = join(rootDir, 'migrations');

  const dbConfig = resolveDatabaseConfig({
    get: (key: string) => process.env[key],
  });

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl,
  });
  const migrationClient: QueryableClient = {
    query: <T extends object>(sql: string, parameters?: unknown[]) =>
      client.query<T>(sql, parameters),
  };

  await client.connect();

  try {
    switch (command) {
      case 'status': {
        console.log(
          `\nVerificando status de migrações em [${dbConfig.database}]...\n`,
        );
        const statuses = await getMigrationStatus(
          migrationsDir,
          migrationClient,
        );

        console.table(
          statuses.map((s) => ({
            Migração: s.name,
            Status: s.status === 'APPLIED' ? '✅ APLICADA' : '⏳ PENDENTE',
            Checksum: s.checksum.slice(0, 10),
            'Aplicada Em': s.applied_at ? s.applied_at.toISOString() : '-',
          })),
        );

        const pendingCount = statuses.filter(
          (s) => s.status === 'PENDING',
        ).length;
        console.log(
          `\nTotal: ${statuses.length} migrações | Aplicadas: ${
            statuses.length - pendingCount
          } | Pendentes: ${pendingCount}\n`,
        );
        break;
      }

      case 'dry-run': {
        console.log(
          `\n[DRY-RUN] Simulando migrações em [${dbConfig.database}]...\n`,
        );
        const result = await runPendingMigrations(
          migrationsDir,
          migrationClient,
          { dryRun: true },
        );
        console.log(
          `\nSimulação concluída: ${result.applied.length} migração(ões) pendente(s).\n`,
        );
        break;
      }

      case 'mark-baseline': {
        console.log(
          `\nRegistrando migrações existentes como baseline em [${dbConfig.database}]...\n`,
        );
        const marked = await markMigrationsAsApplied(
          migrationsDir,
          migrationClient,
        );
        if (marked.length === 0) {
          console.log('Nenhuma migração pendente para marcar como baseline.');
        } else {
          console.log(`Marcadas como aplicadas (${marked.length}):`);
          marked.forEach((m) => console.log(`  - ${m}`));
        }
        break;
      }

      case 'run':
      default: {
        console.log(
          `\nIniciando execução de migrações em [${dbConfig.database}]...\n`,
        );
        const result = await runPendingMigrations(
          migrationsDir,
          migrationClient,
        );

        if (result.applied.length === 0) {
          console.log(
            '✅ Banco de dados já está atualizado. Nenhuma migração pendente.\n',
          );
        } else {
          console.log(
            `\n✅ Sucesso! ${result.applied.length} migração(ões) aplicada(s) com sucesso.\n`,
          );
        }
        break;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('\n❌ Erro durante o processo de migração:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
