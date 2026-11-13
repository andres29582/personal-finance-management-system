const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  ports,
  staticFile,
  run,
  browserFailures,
} = require('./access-browser-runner.cjs');

test('access runner refuses missing disposable configuration before allocating resources', async () => {
  await assert.rejects(run({}), /Explicit|E2E|disposable/i);
});
test('access runner rejects privileged, equal and malformed listener ports', () => {
  for (const env of [
    { ACCESS_API_PORT: '80' },
    { ACCESS_API_PORT: '4319', ACCESS_WEB_PORT: '4319' },
    { ACCESS_WEB_PORT: 'not-a-port' },
  ])
    assert.throws(() => ports(env));
});
test('static access server confines encoded traversal to its generated export', () => {
  const root = path.resolve('access-export');
  assert.equal(staticFile(root, '/login'), path.join(root, 'login'));
  assert.throws(() => staticFile(root, '/..%2f..%2fprivate'));
  assert.throws(() => staticFile(root, '/%5c..%5c..%5cprivate'));
});

test('browser failures expose only ordinal cases, fixed statuses and source lines', () => {
  const privateText = 'password=synthetic-private-value';
  const report = {
    suites: [
      {
        suites: [
          {
            specs: [
              {
                title: privateText,
                tests: [
                  {
                    results: [
                      {
                        status: 'failed',
                        stdout: [privateText],
                        attachments: [{ body: privateText }],
                        errors: [
                          {
                            message: privateText,
                            location: {
                              file: '/private/access.spec.ts',
                              line: 85,
                            },
                          },
                        ],
                      },
                      { status: 'passed' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const summary = browserFailures(report);
  assert.deepEqual(summary, [{ case: 1, status: 'failed', line: 85 }]);
  assert.equal(JSON.stringify(summary).includes(privateText), false);
  report.suites[0].suites[0].specs[0].tests[0].results[0].errors[0].location.file =
    '/private/credentials.json';
  assert.deepEqual(browserFailures(report), [
    { case: 1, status: 'failed', line: 0 },
  ]);
});
