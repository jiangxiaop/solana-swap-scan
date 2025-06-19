#!/usr/bin/env -S deno run --allow-all

import { snapshotScheduler } from "./index.ts";

console.log("🚀 Starting Snapshot Scheduler...");
console.log("📊 Configuration:");
console.log("   - Snapshot interval: 50 blocks");
console.log("   - Safety buffer: 10 blocks (won't process latest 10 blocks)");
console.log("   - Check interval: 30 seconds");

// 优雅关闭处理
const handleShutdown = () => {
    console.log("\n📤 Received shutdown signal, stopping snapshot scheduler...");
    snapshotScheduler.stop();
    Deno.exit(0);
};

// 监听关闭信号
Deno.addSignalListener("SIGINT", handleShutdown);
Deno.addSignalListener("SIGTERM", handleShutdown);

// 启动调度器
snapshotScheduler.start().catch((error) => {
    console.error("❌ Snapshot scheduler failed to start:", error);
    Deno.exit(1);
}); 