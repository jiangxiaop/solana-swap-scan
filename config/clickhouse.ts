// config/clickhouse.ts

import { createClient } from "npm:@clickhouse/client";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载 .env 配置
const env = await load();

const clickhouseClient = createClient({
    url: env["CLICKHOUSE_HOST"],
    username: env["CLICKHOUSE_USER"] ?? "default",
    password: env["CLICKHOUSE_PASSWORD"] ?? "",
    database: env["CLICKHOUSE_DB"] ?? "default",
    
    // 连接池配置
    max_open_connections: 20,  // 最大连接数（控制每个进程的连接数）
    
    // 超时配置
    request_timeout: 30000,    // 30秒请求超时
    connect_timeout: 10000,    // 10秒连接超时
    
    // 压缩配置
    compression: {
        request: true,
        response: true
    },
    
    // 保活配置
    keep_alive: {
        enabled: true,
        idle_socket_ttl: 2500,
        socket_ttl: 60000
    },
    
    // 查询配置
    query_options: {
        max_execution_time: 30,  // 查询最大执行时间（秒）
        max_memory_usage: '2000000000', // 2GB内存限制
    }
});

// 定期清理连接池
const CONNECTION_CLEANUP_INTERVAL = 60000; // 60秒

let cleanupInterval: any;

function startConnectionCleanup() {
    cleanupInterval = setInterval(() => {
        try {
            // 强制垃圾回收（如果可用）
            if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }
        } catch (error) {
            // 忽略GC错误
        }
    }, CONNECTION_CLEANUP_INTERVAL);
}

function stopConnectionCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// 启动清理定时器
startConnectionCleanup();

// 优雅关闭处理
// @ts-ignore: Deno is available in runtime
Deno.addSignalListener?.("SIGINT", async () => {
    stopConnectionCleanup();
    await clickhouseClient.close?.();
});

// @ts-ignore: Deno is available in runtime  
Deno.addSignalListener?.("SIGTERM", async () => {
    stopConnectionCleanup();
    await clickhouseClient.close?.();
});

export default clickhouseClient;
export { stopConnectionCleanup };
