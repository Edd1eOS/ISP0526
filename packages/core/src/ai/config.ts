// Model selection. Business code calls getModel('narrative') instead of
// hard-coding provider/model strings. Concrete model IDs are read from env
// at call time; the AI SDK adapter resolves the role -> provider client.

export type ModelRole = "narrative" | "extraction" | "translation";

const DEFAULTS: Record<ModelRole, string> = {
    narrative: "openai:gpt-4o-mini",
    extraction: "openai:gpt-4o-mini",
    translation: "openai:gpt-4o-mini",
};

export function getModel(role: ModelRole): string {
    const envKey = `ISP_MODEL_${role.toUpperCase()}`;
    const fromEnv = readEnv(envKey);
    return fromEnv ?? DEFAULTS[role];
}

function readEnv(key: string): string | undefined {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[key];
}
