const assert = require('node:assert/strict');
const ORDER = ['before', 'error', 'after'];

function orderedToc(text, owner) {
  assert.match(owner, /^finance_e2e_[a-z0-9_]+$/);
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith(';'));
  assert.equal(lines.length, 3, 'Exactly three TABLE entries required');
  const entries = lines.map((line) => {
    const match =
      /^(\d+); 1259 (\d+) TABLE public (before|error|after) (finance_e2e_[a-z0-9_]+)$/.exec(
        line,
      );
    assert.ok(match, 'Unexpected TOC entry');
    assert.equal(match[4], owner);
    return { id: Number(match[1]), name: match[3], line };
  });
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 3);
  assert.deepEqual(
    entries.map((entry) => entry.name).sort(),
    [...ORDER].sort(),
  );
  const ordered = ORDER.map((name) =>
    entries.find((entry) => entry.name === name),
  );
  return ordered.map((entry) => entry.line).join('\n') + '\n';
}

function classifyRestore(status, stderr, control) {
  assert.equal(status.exitCode, 1, 'Native SQL-error exit 1 required');
  assert.equal(status.signal, null);
  assert.equal(status.cause, 'exit');
  // Only the fixed synthetic CREATE diagnostic is admitted, never arbitrary nonzero exits.
  const diagnostic =
    /^pg_restore: error: could not execute query: ERROR:\s+(?:(42P07):\s+)?relation "error" already exists\s+Command was: CREATE TABLE public\.error \(\s+marker text\s+\);\s*(pg_restore: warning: errors ignored on restore: 1\s*)?$/.exec(
      stderr.replaceAll('\r\n', '\n'),
    );
  assert.ok(diagnostic, 'Unexpected native diagnostic');
  assert.equal(
    Boolean(diagnostic[2]),
    control,
    'Control must report exactly one ignored error',
  );
  return {
    exitCode: status.exitCode,
    signal: status.signal,
    cause: status.cause,
    diagnosticCategory: 'duplicate_table',
    observedSqlState: diagnostic[1] || null,
  };
}

function keys(value, expected) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function validateNegative(proof) {
  keys(proof, [
    'case',
    'status',
    'intendedNegative',
    'toc',
    'failFast',
    'control',
    'normalContinuation',
    'counts',
  ]);
  assert.equal(proof.case, 'C6_SQL_ERROR');
  assert.equal(proof.status, 'completed');
  assert.equal(proof.intendedNegative, true);
  assert.deepEqual(proof.toc, {
    entryTypes: ['TABLE', 'TABLE', 'TABLE'],
    order: ORDER,
    entries: 3,
  });
  for (const [phase, afterExists] of [
    ['failFast', false],
    ['control', true],
  ]) {
    keys(proof[phase], ['native', 'sentinels']);
    const native = proof[phase].native;
    keys(native, [
      'exitCode',
      'signal',
      'cause',
      'diagnosticCategory',
      'observedSqlState',
    ]);
    assert.equal(native.exitCode, 1);
    assert.equal(native.signal, null);
    assert.equal(native.cause, 'exit');
    assert.equal(native.diagnosticCategory, 'duplicate_table');
    assert.ok(
      native.observedSqlState === null || native.observedSqlState === '42P07',
    );
    assert.deepEqual(proof[phase].sentinels, {
      beforeExists: true,
      errorExists: true,
      markerPreserved: true,
      afterExists,
    });
  }
  assert.deepEqual(proof.normalContinuation, { http: 0, authority: 0 });
  assert.deepEqual(proof.counts, {
    nativeRestores: 2,
    expectedSqlErrors: 2,
    passed: 2,
  });
  return proof;
}

function validateCleanup(runtime) {
  assert.equal(runtime.case, 'C6_SQL_ERROR');
  assert.equal(runtime.status, 'completed');
  assert.equal(runtime.backendNotStarted, true);
  assert.deepEqual(runtime.cleanup, {
    commandChildrenExited: true,
    backendExited: false,
    pgStopped: true,
    portsFree: true,
  });
  assert.equal(runtime.frozenSourceUnchanged, true);
  assert.equal(runtime.externalUnchanged, true);
}

module.exports = {
  ORDER,
  orderedToc,
  classifyRestore,
  validateNegative,
  validateCleanup,
};
