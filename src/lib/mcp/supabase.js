import { createClient } from "@supabase/supabase-js";
function runtimeEnv(name) {
    const runtime = globalThis;
    return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}
function configuredEnv(names) {
    for (const name of names) {
        const value = runtimeEnv(name)?.trim();
        if (value)
            return value;
    }
    return undefined;
}
function supabaseProjectUrl() {
    const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
    if (!url)
        throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
    return url;
}
function supabasePublishableKey() {
    const direct = configuredEnv([
        "SUPABASE_PUBLISHABLE_KEY",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]);
    if (direct)
        return direct;
    const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
    if (keyset) {
        try {
            const parsed = JSON.parse(keyset);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const keys = parsed;
                const key = [keys['default'], ...Object.values(keys)]
                    .find((v) => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
                    ?.trim();
                if (key)
                    return key;
            }
        }
        catch {
            /* malformed dictionary; fall through to legacy names */
        }
    }
    const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
    if (legacy)
        return legacy;
    throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}
/** Forwards the verified OAuth bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx) {
    const token = ctx.getToken();
    if (!token)
        throw new Error("supabaseForUser requires a verified OAuth token");
    return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
export function notAuthenticated() {
    return {
        content: [{ type: "text", text: "Not authenticated. Connect this app with OAuth first." }],
        isError: true,
    };
}
