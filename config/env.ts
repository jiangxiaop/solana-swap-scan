import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载对应环境的 .env 文件
const envPath = Deno.env.get("DENO_ENV") === "production" ? ".env.production" : ".env";
const env = await load({ envPath });

function getEnv(key: string, fallback?: string): string {
    const val = Deno.env.get(key) ?? env[key] ?? fallback;
    if (val === undefined) {
        throw new Error(`环境变量 ${key} 未定义，且未提供默认值`);
    }
    return val;
}

// 导出需要使用的配置项
export const config = {
    apiKey: getEnv("API_KEY"),
    port: parseInt(getEnv("PORT", "3000")),
};
