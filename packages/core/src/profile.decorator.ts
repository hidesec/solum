import "./reflect-metadata";
import { getFrameworkConfig } from "./framework-config";

const PROFILE_METADATA_KEY = "custom:profile";

export function Profile(...profiles: string[]): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(PROFILE_METADATA_KEY, profiles, target as object);
    };
}

export function getActiveProfiles(): string[] {
    const raw = getFrameworkConfig().get("NODE_ENV") ?? process.env.NODE_ENV ?? "development";
    return raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p !== "");
}

export function matchesActiveProfile(profiles: string[]): boolean {
    const active = new Set(getActiveProfiles());
    return profiles.some((p) => active.has(p));
}

export function getProfileCondition(target: object): (() => boolean) | undefined {
    const profiles = Reflect.getMetadata(PROFILE_METADATA_KEY, target) as string[] | undefined;
    if (!profiles || profiles.length === 0) return undefined;
    return () => matchesActiveProfile(profiles);
}
