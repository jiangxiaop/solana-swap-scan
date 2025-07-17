// config/clickhouse-high-performance.ts
// 高性能ClickHouse配置 - 速度优先

import { createClient } from "npm:@clickhouse/client";
import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";

// 加载 .env 配置
const env = await load();

const clickhouseHighPerformanceClient = createClient({
    url: env["CLICKHOUSE_HOST"],
    username: env["CLICKHOUSE_USER"] ?? "default",
    password: env["CLICKHOUSE_PASSWORD"] ?? "",
    database: env["CLICKHOUSE_DB"] ?? "default",
    
    // 高性能连接池配置
    max_open_connections: 100,  // 大幅增加连接数以支持高并发
    
    // 高性能超时配置
    request_timeout: 120000,    // 2分钟请求超时，允许更长时间的大批量操作
    connect_timeout: 5000,      // 5秒连接超时，快速连接
    
    // 高性能压缩配置
    compression: {
        request: true,
        response: true
    },
    
    // 保活配置
    keep_alive: {
        enabled: true,
        idle_socket_ttl: 10000,   // 10秒空闲超时，更积极的连接复用
        socket_ttl: 300000        // 5分钟socket生存时间
    },
    
    // 高性能查询配置
    query_options: {
        max_execution_time: 120,           // 2分钟最大执行时间
        max_memory_usage: '8000000000',    // 8GB内存限制，充分利用服务器资源
        max_threads: 16,                   // 最大线程数
        max_block_size: 1000000,          // 增大块大小，提高批量插入性能
        
        // 优化插入性能
        async_insert: 1,                   // 启用异步插入
        wait_for_async_insert: 0,          // 不等待异步插入完成
        async_insert_max_data_size: 100000000, // 100MB异步插入缓冲区
        async_insert_busy_timeout_ms: 1000,     // 1秒忙等超时
        
        // 关闭一些检查以提高性能
        allow_suspicious_low_cardinality_types: 1,
        allow_experimental_analyzer: 1,
        
        // 优化网络性能
        network_compression_method: 'lz4',
        network_zstd_compression_level: 1,
        
        // 内存优化
        join_use_nulls: 0,
        max_memory_usage_for_user: '16000000000', // 16GB用户内存限制
    }
});

console.log("🚀 High Performance ClickHouse client initialized");
console.log("   Max connections: 100");
console.log("   Max memory: 8GB per query, 16GB per user");
console.log("   Async insert enabled");

export default clickhouseHighPerformanceClient; 