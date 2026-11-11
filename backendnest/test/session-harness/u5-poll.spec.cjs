const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');
const { expect } = require('../../../frontend/node_modules/@playwright/test');

// Exercise the maintained wrapper with the actual installed expect.poll, no browser.
const source = fs.readFileSync(
  path.join(__dirname, 'u5-browser.spec.ts'),
  'utf8',
);
const start = source.indexOf('async function ownedProtectedSample(');
const end = source.indexOf('\nfunction passwordInput(', start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const ownedProtectedSample = new Function(
  'expect',
  compiled + '\nreturn ownedProtectedSample;',
)(expect);

async function main() {
  const matching = {
    at: 42,
    path: '/sessoes',
    identity: {
      sid: 'owned-sid',
      signedOut: false,
      authorityOwned: true,
      authority: { idleTimeoutSeconds: 900 },
      authorityEpoch: 23,
    },
    protectedVisible: true,
    currentSessionVisible: true,
    unavailableVisible: false,
  };
  const stale = {
    ...matching,
    identity: { ...matching.identity, authorityOwned: false },
  };
  let reads = 0;
  const page = {
    async evaluate() {
      await Promise.resolve();
      reads++;
      return reads < 3 ? stale : matching;
    },
    async waitForFunction() {
      // Audited coreBundle.js:25681-25710 checks Promise truthiness, then adopts false.
      const success = Promise.resolve(false);
      if (success)
        return { jsonValue: async () => success, dispose: async () => {} };
      throw Error('Unreachable for an async predicate');
    },
  };
  const result = await ownedProtectedSample(page, 'owned-sid', '/sessoes', {
    timeout: 1000,
    intervals: [20],
  });
  assert.equal(reads, 3, 'Async stale observations must not finish polling');
  assert.strictEqual(
    result,
    matching,
    'Return the exact matching sample, not a later read',
  );
  assert.equal(result.identity.authorityEpoch, 23);
  console.log(
    'PASS: awaited stale -> stale -> matching; exact matching snapshot retained',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
