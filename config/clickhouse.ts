// config/clickhouse.ts

import { createClient } from "npm:@clickhouse/client";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载 .env 配置
const env = await load();

const clickhouseClient =  createClient({
    url: env["CLICKHOUSE_HOST"],
    username: env["CLICKHOUSE_USER"] ?? "default",
    password: env["CLICKHOUSE_PASSWORD"] ?? "",
    database: env["CLICKHOUSE_DB"] ?? "default",
    // optional: add query timeout or compression here
});

export default clickhouseClient;
