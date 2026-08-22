import path from "path";
import { mergeYaml, flattenYaml, resolvePlaceholders, loadYamlFile, YamlDocument } from "./yaml-parser";

function detectActiveProfile(): string {
    return process.env.SOLUM_PROFILE || process.env.NODE_ENV || "development";
}

export function loadProfileConfig(configDir?: string, configFileName?: string): Record<string, string> {
    const dir = configDir || process.cwd();
    const fileName = configFileName || "application";
    const activeProfile = detectActiveProfile();

    const baseFile = path.join(dir, `${fileName}.yml`);
    const profileFile = path.join(dir, `${fileName}.${activeProfile}.yml`);

    let doc: YamlDocument = {};

    const base = loadYamlFile(baseFile);
    if (base) {
        doc = mergeYaml(doc, base);
    }

    const profile = loadYamlFile(profileFile);
    if (profile) {
        doc = mergeYaml(doc, profile);
    }

    const envMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            envMap[key] = value;
        }
    }

    doc = resolvePlaceholders(doc, envMap);

    return flattenYaml(doc);
}

export function createYamlConfig(configDir?: string, configFileName?: string): Record<string, string> {
    const yamlConfig = loadProfileConfig(configDir, configFileName);

    const merged: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            merged[key] = value;
        }
    }

    for (const [key, value] of Object.entries(yamlConfig)) {
        if (!(key in process.env) || process.env[key] === undefined) {
            merged[key] = value;
        }
    }

    return merged;
}
