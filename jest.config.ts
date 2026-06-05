import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
 globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@earendil-works/pi-coding-agent$': '<rootDir>/node_modules/@earendil-works/pi-coding-agent/dist/index.js',
    '^@earendil-works/pi-coding-agent/(.*)$': '<rootDir>/node_modules/@earendil-works/pi-coding-agent/dist/$1',
  },

  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json', 'node'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};

export default config;
