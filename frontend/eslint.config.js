// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'coverage/**', 'smoke-web/**'],
  },
  {
    files: ['scripts/**/*.{js,cjs}', 'tests/**/*.cjs', 'eslint.config.js', 'jest.config.js'],
    languageOptions: { globals: { __dirname: 'readonly', __filename: 'readonly' } },
  },
]);
