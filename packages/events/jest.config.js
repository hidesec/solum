module.exports = {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__test__/**/*.test.ts"],
    "transform": { "^.+\\.ts$": ["ts-jest", {}] },
    "moduleFileExtensions": ["ts", "js", "json"],
    "moduleNameMapper": {
        "^@solumjs/core$": "<rootDir>/../core/src/index.ts",
        "^@solumjs/orm$": "<rootDir>/../orm/src/index.ts",
        "^@solumjs/http$": "<rootDir>/../http/src/index.ts",
        "^@solumjs/database$": "<rootDir>/../database/src/index.ts"
    }
};
