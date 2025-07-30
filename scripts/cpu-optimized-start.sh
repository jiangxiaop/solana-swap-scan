#!/bin/bash

# Solana Swap Scan - CPU Optimized Start Script
# 平衡性能和CPU使用率

echo "⚡ CPU Optimized Mode - Balanced Performance"
echo "🎯 Target: 60-80% CPU utilization maximum"
echo "💻 Available CPUs: $(nproc)"
echo ""

# 创建必要的目录
mkdir -p logs
mkdir -p pids

# 设置CPU优化环境变量
export HIGH_PERFORMANCE_MODE=false
export CPU_OPTIMIZED_MODE=true
export MAX_CPU_PERCENT=75
export WORKER_DELAY=200  # 毫秒延迟启动

# 计算最佳worker数量 (CPU核心数的75%)
MAX_WORKERS=$(echo "$(nproc) * 0.5" | bc | cut -d. -f1)
if [ $MAX_WORKERS -gt 31 ]; then
    MAX_WORKERS=31
fi
if [ $MAX_WORKERS -lt 4 ]; then
    MAX_WORKERS=4
fi

echo "🔄 Starting $MAX_WORKERS workers (75% of $(nproc) CPUs)"

# 启动负载均衡器
echo "🌐 Starting Load Balancer on port 7999..."
nohup node --max-old-space-size=512 load-balancer.ts > logs/load-balancer.log 2>&1 &
LOAD_BALANCER_PID=$!
echo $LOAD_BALANCER_PID > pids/load-balancer.pid
echo "Load Balancer PID: $LOAD_BALANCER_PID"

# 等待负载均衡器启动
sleep 2

# 启动worker进程（带CPU限制）
for i in $(seq 0 $((MAX_WORKERS-1))); do
    PORT=$((8000 + i))
    echo "🚀 Starting Worker $i on port $PORT..."
    
    # 使用cpulimit限制单个进程CPU使用率
    nohup nice -n 5 deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags=--memory-saver-mode,--max-old-space-size=512,--gc-interval=100 \
        src/server.ts $PORT > logs/server-$PORT.log 2>&1 &
    
    WORKER_PID=$!
    echo $WORKER_PID > pids/worker-$PORT.pid
    echo "Worker $i PID: $WORKER_PID"
    
    # 设置进程CPU限制 (每个进程最多使用单核的80%)
    if command -v cpulimit &> /dev/null; then
        cpulimit -p $WORKER_PID -l 80 &
        echo $! > pids/cpulimit-$PORT.pid
    fi
    
    # 延迟启动避免CPU峰值
    sleep $(echo "$WORKER_DELAY / 100" | bc -l)
done

echo ""
echo "✅ CPU Optimized cluster started successfully!"
echo "📊 Workers: $MAX_WORKERS"
echo "🌐 Load Balancer: http://localhost:7999"
echo "📈 Max CPU per process: 80%"
echo "🎛️ Process priority: nice +5 (lower priority)"
echo ""
echo "📋 Management Commands:"
echo "  Monitor: bash scripts/monitor-cpu.sh"
echo "  Stop:    bash scripts/stop-cluster.sh"
echo "  Status:  bash scripts/cluster-status.sh"
echo ""
echo "🔧 To install cpulimit for better CPU control:"
echo "  sudo apt-get update && sudo apt-get install -y cpulimit" 