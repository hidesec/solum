const tsconfig = require("./tsconfig.json");

function buildModuleNameMapper() {
    const paths = tsconfig.compilerOptions.paths || {};
    const mapper = {};
    for (const [alias, targets] of Object.entries(paths)) {
        const pattern = `^${alias.replace(/\*/g, "(.*)")}$`;
        mapper[pattern] = targets.map((target) => `<rootDir>/${target.replace(/^\.\//, "").replace(/\*/g, "$1")}`);
    }
    return mapper;
}

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/__test__/**/*.test.ts", "**/__tests__/**/*.test.ts"],
    transform: {
        "^.+\\.ts$": ["ts-jest", {}],
    },
    moduleFileExtensions: ["ts", "js", "json"],
    moduleNameMapper: buildModuleNameMapper(),
};
