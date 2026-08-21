const { register } = require("tsconfig-paths");

register({
    baseUrl: require("path").join(__dirname, "dist"),
    paths: {
        "@config/*": ["config/*"],
        "@controllers/*": ["controllers/*"],
        "@database/*": ["database/*"],
        "@dto/*": ["dto/*"],
        "@entities/*": ["entities/*"],
        "@repositories/*": ["repositories/*"],
        "@services/*": ["services/*"],
        "@tasks/*": ["tasks/*"]
    }
});
