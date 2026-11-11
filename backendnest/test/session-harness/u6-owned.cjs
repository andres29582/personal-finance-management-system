const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const repo = path.resolve(__dirname, '../../..');
function confined(file, root) {
  const absolute = path.resolve(file);
  assert.ok(absolute === root || absolute.startsWith(root + path.sep));
  for (let current = absolute; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) {
      assert.equal(fs.lstatSync(current).isSymbolicLink(), false);
      assert.equal(
        fs.realpathSync.native(current).toLowerCase(),
        current.toLowerCase(),
      );
    }
    if (path.dirname(current) === current) break;
  }
  return absolute;
}
function cleanEnv(root) {
  const system = process.env.SystemRoot;
  return {
    SystemRoot: system,
    WINDIR: system,
    ProgramFiles: process.env.ProgramFiles,
    PATH: [
      path.dirname(process.execPath),
      system && path.join(system, 'System32'),
    ]
      .filter(Boolean)
      .join(path.delimiter),
    TEMP: root,
    TMP: root,
    NODE_ENV: 'test',
    TZ: 'UTC',
  };
}
function waitExit(child, capMs) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error('Owned exit unconfirmed')),
      capMs,
    );
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
async function assignJob(child, root) {
  assert.equal(
    process.platform,
    'win32',
    'Native ownership supports Windows only',
  );
  const executable = path.join(
    process.env.SystemRoot,
    'System32/WindowsPowerShell/v1.0/powershell.exe',
  );
  const guardian = spawn(
    executable,
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(__dirname, 'u6-job.ps1'),
      '-OwnedPid',
      String(child.pid),
    ],
    {
      shell: false,
      windowsHide: true,
      env: cleanEnv(root),
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const lines = readline.createInterface({ input: guardian.stdout });
  let waiter, failed;
  lines.on('line', (line) => {
    try {
      const value = JSON.parse(line);
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        resolve(value);
      } else failed = Error('Unexpected guardian output');
    } catch {
      failed = Error('Malformed guardian evidence');
    }
  });
  guardian.once('error', () => {
    failed = Error('Guardian unavailable');
  });
  guardian.stderr.resume();
  const next = (capMs = 30000) =>
    new Promise((resolve, reject) => {
      if (failed) return reject(failed);
      const timer = setTimeout(() => {
        waiter = null;
        reject(Error('Guardian evidence timeout'));
      }, capMs);
      waiter = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      guardian.once('exit', () => {
        clearTimeout(timer);
        reject(Error('Guardian exited without evidence'));
      });
    });
  try {
    const first = await next();
    assert.deepEqual(Object.keys(first).sort(), [
      'creation',
      'members',
      'pid',
      'type',
    ]);
    assert.equal(first.type, 'assigned');
    assert.equal(first.pid, child.pid);
    assert.ok(Number.isFinite(Date.parse(first.creation)));
    assert.deepEqual(first.members, [child.pid]);
    return {
      creation: first.creation,
      async finish() {
        const pending = next(10000);
        guardian.stdin.write('members\n');
        const readback = await pending;
        assert.deepEqual(Object.keys(readback).sort(), ['members', 'type']);
        assert.equal(readback.type, 'members');
        const empty =
          Array.isArray(readback.members) && readback.members.length === 0;
        if (empty) guardian.stdin.end('close\n');
        else guardian.stdin.end();
        const exited = await waitExit(guardian, 10000);
        assert.equal(exited.code, 0);
        assert.equal(
          empty,
          true,
          'Owned descendants required forced job cleanup',
        );
        return true;
      },
      abandon() {
        guardian.stdin.end();
      },
    };
  } catch (error) {
    guardian.stdin.end();
    throw error;
  }
}
function launchOwner(script, args, binding, logRoot) {
  const out = fs.openSync(path.join(logRoot, 'owner.stdout.log'), 'wx');
  const err = fs.openSync(path.join(logRoot, 'owner.stderr.log'), 'wx');
  try {
    return spawn(process.execPath, [script, ...args], {
      cwd: logRoot,
      env: {
        ...cleanEnv(logRoot),
        U6_COORDINATOR_BINDING: JSON.stringify(binding),
      },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', out, err, 'ipc'],
    });
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
}
module.exports = { cleanEnv, waitExit, assignJob, launchOwner, repo, confined };
