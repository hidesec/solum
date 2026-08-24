/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__test__/**/*.test.ts"],
  moduleNameMapper: {
    "^@solumjs/core$": "<rootDir>/../core/src/index.ts",
  },
};