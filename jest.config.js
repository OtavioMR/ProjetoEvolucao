module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/core/date-time/**/*.ts'],
};
