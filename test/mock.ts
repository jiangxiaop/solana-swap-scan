import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

export const loadEnv = async () => {
    const env = await load();
    for (const key in env) {
        Deno.env.set(key, env[key]);
    }
}
