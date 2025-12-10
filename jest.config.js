module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.{service,controller,dto}.ts',
    '!**/*.spec.ts',
    '!**/interfaces/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
};
