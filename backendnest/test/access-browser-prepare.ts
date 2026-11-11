import { configureE2eEnvironment, prepareE2eDatabase } from './e2e-database';

async function prepare() {
  const config = configureE2eEnvironment();
  await prepareE2eDatabase(config);
  console.log('Disposable access database prepared.');
}

void prepare().catch(() => {
  console.error('Disposable access database preparation failed.');
  process.exitCode = 1;
});
