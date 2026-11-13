// Calendar regressions deliberately cross UTC midnight in the Brazilian zone.
// Configure the real process before Jest creates its isolated test environments.
process.env.TZ = 'America/Sao_Paulo';

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts?(x)',
    '<rootDir>/src/**/*.test.ts?(x)',
  ],
};
