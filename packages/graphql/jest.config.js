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
        "^@solumjs/core$": "<rootDir>/../core/src/index.ts"
    }
};
