module.exports = {
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
    },
    env: {
        node: true,
        es2022: true,
    },
    rules: {
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "prefer-const": "error",
        "no-var": "error",
        "eqeqeq": ["error", "always"],
    },
    ignorePatterns: ["dist/", "node_modules/", "*.js", "*.d.ts"],
};
