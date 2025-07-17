# 🧠 内存优化指南

## 🎯 优化概述

本文档详细说明了Solana Swap Scan集群的内存优化措施，解决多进程环境下的资源管理问题。

## ⚠️ 发现的问题

### 1. 数据累积问题
- **问题**：`swapTransactionArray` 会累积大量交易数据
- **影响**：内存持续增长，可能导致OOM
- **解决**：分批处理，立即保存并清理数据

### 2. 无限制并发
- **问题**：`Promise.all()` 同时处理所有区块数据
- **影响**：内存峰值过高，系统负载过大  
- **解决**：限制并发数量，分批处理

### 3. 连接池缺失
- **问题**：ClickHouse连接没有池化管理
- **影响**：连接泄漏，资源浪费
- **解决**：配置连接池和超时参数

### 4. 数学计算错误
- **问题**：除零错误导致处理中断
- **影响**：数据残留在内存中未清理
- **解决**：安全数学操作，错误恢复机制

## 🔧 实施的优化

### 1. ClickHouse连接池优化

```typescript
// config/clickhouse.ts
const clickhouseClient = createClient({
    // 连接池配置
    max_open_connections: 20,
    
    // 超时配置
    request_timeout: 30000,
    connect_timeout: 10000,
    
    // 查询配置
    query_options: {
        max_execution_time: 30,
        max_memory_usage: '2000000000', // 2GB限制
    }
});
```

### 2. 数据处理批量化

```typescript
// src/service/SolanaBlockDataHandler.ts
const BATCH_SIZE = 10; // 控制并发数量
const MAX_MEMORY_ITEMS = 1000; // 最大内存项数

// 分批处理，避免内存峰值
for (let i = 0; i < data.length; i += BATCH_SIZE) {
    // 立即保存数据，避免累积
    if (batchTransactions.length > MAX_MEMORY_ITEMS) {
        await this.insertToHistoryTable(batchTransactions);
        batchTransactions.length = 0; // 清空数组
        this.forceGarbageCollection();
    }
}
```

### 3. 安全数学操作

```typescript
// src/utils/MathUtil.ts
static safeDivide(a: number | string, b: number | string, defaultValue = "0"): string {
    const divisor = new Decimal(b);
    if (divisor.isZero()) {
        return defaultValue;
    }
    return new Decimal(a).dividedBy(divisor).toString();
}
```

### 4. V8引擎优化参数

```bash
# scripts/memory-optimized-start.sh
deno run \
    --v8-flags="--max-heap-size=512m" \
    --v8-flags="--max-old-space-size=400m" \
    --v8-flags="--gc-interval=100" \
    --v8-flags="--optimize-for-size" \
    --v8-flags="--memory-reducer" \
    $SCRIPT_PATH $port
```

## 📊 内存监控系统

### 实时监控脚本

```bash
# 启动内存监控
bash scripts/monitor-memory.sh

# 内存优化启动（包含监控）
bash scripts/memory-optimized-start.sh
```

### 监控指标

- **系统内存使用率**：总体内存消耗
- **进程内存使用**：每个Deno进程的RSS/VSZ
- **内存增长趋势**：检测内存泄漏
- **警告阈值**：超过80%时自动告警

## 🚀 使用指南

### 1. 标准启动（已优化）

```bash
# 使用优化后的标准启动
bash scripts/start-full-cluster.sh
```

### 2. 内存优化启动（推荐）

```bash
# 使用内存优化启动脚本
bash scripts/memory-optimized-start.sh
```

### 3. 实时监控

```bash
# 启动独立监控
bash scripts/monitor-memory.sh

# 查看监控日志
tail -f logs/memory-monitor.log
```

## 📈 性能对比

### 优化前
- **内存增长**：持续增长，可能OOM
- **并发处理**：无限制，系统负载高
- **错误处理**：崩溃时数据丢失
- **连接管理**：可能出现连接泄漏

### 优化后
- **内存控制**：分批处理，及时清理
- **稳定并发**：限制10个并发，系统负载可控
- **错误恢复**：单个错误不影响整体处理
- **连接池化**：20个连接限制，自动清理

## ⚙️ 配置调优

### 根据服务器配置调整

```bash
# 低内存服务器（< 8GB）
MAX_HEAP_SIZE="256m"
BATCH_SIZE=5
MAX_MEMORY_ITEMS=500

# 中等内存服务器（8-16GB）
MAX_HEAP_SIZE="512m" 
BATCH_SIZE=10
MAX_MEMORY_ITEMS=1000

# 高内存服务器（> 16GB）
MAX_HEAP_SIZE="1024m"
BATCH_SIZE=20  
MAX_MEMORY_ITEMS=2000
```

### 进程数量调整

```bash
# 基于CPU核心数
CPU_CORES=$(nproc)
RECOMMENDED_PROCESSES=$((CPU_CORES * 2))

# 修改端口范围
START_PORT=8000
END_PORT=$((8000 + RECOMMENDED_PROCESSES - 1))
```

## 🛡️ 监控警告

### 内存警告级别

- **绿色（< 60%）**：正常运行
- **黄色（60-80%）**：中等负载，需关注
- **红色（> 80%）**：高负载，需要优化

### 自动优化建议

监控脚本会自动提供优化建议：

- 重启集群释放内存
- 调整批处理大小
- 检查内存泄漏
- 监控数据库连接
- 强制垃圾回收

## 🔄 故障恢复

### 内存不足处理

```bash
# 1. 立即重启集群
bash scripts/stop-full-cluster.sh
bash scripts/memory-optimized-start.sh

# 2. 减少进程数量
# 编辑 scripts/memory-optimized-start.sh
END_PORT=8020  # 从31个进程减少到21个

# 3. 减少批处理大小
# 编辑 src/service/SolanaBlockDataHandler.ts
const BATCH_SIZE = 5;  # 从10减少到5
const MAX_MEMORY_ITEMS = 500;  # 从1000减少到500
```

### 连接泄漏处理

```bash
# 检查连接数
netstat -an | grep :9000 | wc -l

# 重启数据库连接
# 重启集群会自动清理连接
```

## 📝 最佳实践

### 1. 定期监控
- 每日检查内存使用趋势
- 设置自动化监控告警
- 记录内存使用模式

### 2. 容量规划
- 根据数据量调整进程数
- 预留30%内存缓冲
- 监控磁盘I/O性能

### 3. 故障预防
- 定期重启集群（每周一次）
- 监控日志中的错误模式
- 备份重要配置和数据

## 🎯 性能指标

### 目标指标
- **内存使用率**：< 70%
- **进程内存**：< 200MB/进程
- **响应时间**：< 1秒
- **错误率**：< 1%

### 监控命令

```bash
# 快速检查
free -h
ps aux | grep deno | head -5

# 详细监控
bash scripts/monitor-memory.sh

# 性能测试
bash scripts/test-cluster.sh
```

---

🎉 **通过这些优化措施，你的集群现在能够稳定运行，有效控制内存使用，并提供可靠的服务！** 