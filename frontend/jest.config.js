// Set before Jest starts workers so calendar tests use a deterministic local zone.
process.env.TZ = 'America/Sao_Paulo';

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts?(x)',
    '<rootDir>/src/**/*.test.ts?(x)',
  ],
};
