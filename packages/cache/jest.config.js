module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__test__/**/*.test.ts"],
  moduleNameMapper: {
    "^@solumjs/core$": "<rootDir>/../core/src",
    "^@solumjs/aop$": "<rootDir>/../aop/src",
  },
};
