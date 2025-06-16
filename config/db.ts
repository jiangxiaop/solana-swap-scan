// config/db.ts

import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载 .env
const env = await load();

const client = await new Client().connect({
    hostname: env["MYSQL_HOST"],
    port: parseInt(env["MYSQL_PORT"] ?? "3306"),
    username: env["MYSQL_USER"],
    password: env["MYSQL_PASSWORD"],
    db: env["MYSQL_DATABASE"],
    poolSize: parseInt(env["MYSQL_POOL_SIZE"] ?? "10"),
    charset: "utf8mb4"
});

export default client;
