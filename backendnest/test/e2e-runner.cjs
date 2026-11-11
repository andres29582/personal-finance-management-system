const path = require('node:path');
const runtime = require('./e2e-runtime.cjs');

async function run(
  env = process.env,
  args = process.argv.slice(2),
  dependencies = {},
) {
  const config = runtime.resolveConfig(env);
  const spawn = dependencies.spawn || require('node:child_process').spawn;
  const acquire = dependencies.acquireLease || runtime.acquireLease;
  let child,
    lease,
    stopped = true,
    cancelled = false,
    coordinatorLost = false;
  let hardTimer, finalTimer, runTimer;
  let rejectChild;
  const stop = () => {
    cancelled = true;
    if (child && !stopped) {
      child.kill('SIGTERM');
      hardTimer ??= setTimeout(() => child.kill('SIGKILL'), 5000);
      finalTimer ??= setTimeout(
        () => rejectChild?.(new Error('Owned E2E child shutdown unconfirmed.')),
        10000,
      );
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let primary;
  const cleanup = [];
  try {
    lease = await acquire(config, {
      onLost: () => {
        coordinatorLost = true;
        stop();
      },
    });
    if (!lease.healthy || cancelled)
      throw new Error('E2E coordinator unavailable before launch.');
    const childEnv = runtime.configureEnvironment(config, {
      ...env,
      ...lease.environment,
    });
    await new Promise((resolve, reject) => {
      rejectChild = reject;
      child = spawn(
        process.execPath,
        [
          path.join(__dirname, '../node_modules/jest/bin/jest.js'),
          ...args,
          '--config',
          path.join(__dirname, 'jest-e2e.json'),
          '--runInBand',
        ],
        {
          cwd: path.join(__dirname, '..'),
          env: childEnv,
          stdio: 'inherit',
          shell: false,
        },
      );
      stopped = false;
      runTimer = setTimeout(
        () => {
          stop();
        },
        15 * 60 * 1000,
      );
      child.once('error', (error) => {
        // A failed spawn with no PID never created a participant process.
        if (!child.pid) {
          stopped = true;
          reject(error);
        } else stop();
      });
      child.once('close', (code, signal) => {
        stopped = true;
        if (coordinatorLost)
          reject(new Error('E2E coordinator lost; child stopped.'));
        else if (cancelled || signal || code !== 0)
          reject(new Error('E2E child failed or was cancelled.'));
        else resolve();
      });
    });
  } catch (error) {
    primary = error;
  } finally {
    for (const timer of [runTimer, hardTimer, finalTimer]) clearTimeout(timer);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (lease) {
      try {
        await lease.close({
          participantsStopped: stopped && primary === undefined,
        });
      } catch (error) {
        cleanup.push(error);
      }
    }
  }
  const error = runtime.combine(primary, cleanup);
  if (error) throw error;
}

module.exports = { run };
if (require.main === module)
  run().catch(() => {
    console.error(
      'E2E failed closed. If a run claim remains, discard and reprovision the authorized disposable database.',
    );
    process.exitCode = 1;
  });
