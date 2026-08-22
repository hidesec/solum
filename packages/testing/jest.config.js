module.exports = {
  testMatch: ['<rootDir>/src/__test__/**/*.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: {
    '^@solumjs/core$': '<rootDir>/../core/src/index.ts',
    '^@solumjs/core/(.*)$': '<rootDir>/../core/src/$1',
    '^@solumjs/http$': '<rootDir>/../http/src/index.ts',
    '^@solumjs/http/(.*)$': '<rootDir>/../http/src/$1',
    '^@solumjs/config$': '<rootDir>/../config/src/index.ts',
    '^@solumjs/config/(.*)$': '<rootDir>/../config/src/$1',
    '^@solumjs/orm$': '<rootDir>/../orm/src/index.ts',
    '^@solumjs/orm/(.*)$': '<rootDir>/../orm/src/$1',
  },
};
