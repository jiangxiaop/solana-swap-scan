// config/redis.ts

import { connect } from "https://deno.land/x/redis@v0.32.4/mod.ts";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载环境变量
const env = await load();

const redisClient = await connect({
    hostname: env["REDIS_HOST"] ?? "127.0.0.1",
    port: parseInt(env["REDIS_PORT"] ?? "6379"),
    password: env["REDIS_PASSWORD"] || undefined,
});

export default redisClient;
