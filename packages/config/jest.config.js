module.exports = {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": [
        "**/__test__/**/*.test.ts"
    ],
    "transform": {
        "^.+\\.ts$": [
            "ts-jest",
            {}
        ]
    },
    "moduleFileExtensions": [
        "ts",
        "js",
        "json"
    ],
    "moduleNameMapper": {
        "^@solumjs/core$": "<rootDir>/../core/src/index.ts",
        "^@solumjs/http$": "<rootDir>/../http/src/index.ts",
        "^@solumjs/validation$": "<rootDir>/../validation/src/index.ts",
        "^@solumjs/auth$": "<rootDir>/../auth/src/index.ts",
        "^@solumjs/orm$": "<rootDir>/../orm/src/index.ts",
        "^@solumjs/database$": "<rootDir>/../database/src/index.ts",
        "^@solumjs/cache$": "<rootDir>/../cache/src/index.ts",
        "^@solumjs/schedule$": "<rootDir>/../schedule/src/index.ts",
        "^@solumjs/middlewares$": "<rootDir>/../middlewares/src/index.ts"
    }
};
