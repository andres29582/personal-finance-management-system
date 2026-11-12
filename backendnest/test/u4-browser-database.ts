import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

// This entry runs only with explicit disposable configuration and confinement checks.
async function prepare() {
  const config = configureE2eEnvironment();
  await prepareE2eDatabase(config);
  const source = new DataSource({
    type: 'postgres',
    ...config,
    connectTimeoutMS: 5000,
  });
  await source.initialize();
  try {
    const hash = await bcrypt.hash('U4-disposable-password-42!', 10);
    for (let index = 1; index <= 8; index++) {
      await source.query(
        'INSERT INTO usuario(id,nome,email,senha_hash) VALUES($1,$2,$3,$4)',
        [randomUUID(), `U4 fixture ${index}`, `u4-${index}@example.com`, hash],
      );
    }
    const [identity] = await source.query<
      Array<{ database: string; role: string }>
    >('SELECT current_database() AS database,current_user AS role');
    console.log(JSON.stringify({ prepared: true, ...identity, users: 8 }));
  } finally {
    await source.destroy();
  }
}
void prepare().catch(() => {
  console.error('Disposable database preparation failed.');
  process.exitCode = 1;
});
