#!/bin/bash

# Solana Swap Scan - Multi-Core Optimized Start Script
# 真正的多核分布运行，每个进程绑定到特定CPU核心

echo "🚀 Multi-Core Optimized Mode - True Multi-Core Distribution"
echo "💻 Available CPUs: $(nproc)"
echo "🎯 Strategy: Each worker bound to specific CPU core"
echo ""

# 创建必要的目录
mkdir -p logs
mkdir -p pids

# 获取CPU核心数
TOTAL_CPUS=$(nproc)
echo "🔧 Total CPU cores: $TOTAL_CPUS"

# 计算最佳worker数量 (最多使用80%的核心)
MAX_WORKERS=$(echo "$TOTAL_CPUS * 0.8" | bc | cut -d. -f1)
if [ $MAX_WORKERS -gt 31 ]; then
    MAX_WORKERS=31
fi
if [ $MAX_WORKERS -lt 4 ]; then
    MAX_WORKERS=4
fi

echo "🔄 Starting $MAX_WORKERS workers distributed across CPU cores"

# 检查taskset命令是否可用
if ! command -v taskset &> /dev/null; then
    echo "⚠️  Warning: taskset not found. Installing util-linux..."
    sudo apt-get update && sudo apt-get install -y util-linux
fi

# 设置环境变量
export HIGH_PERFORMANCE_MODE=false
export MULTI_CORE_MODE=true
export MAX_CPU_PERCENT=80

# 启动负载均衡器 (绑定到第一个核心)
echo "🌐 Starting Load Balancer on CPU core 0..."
nohup taskset -c 0 node --max-old-space-size=256 load-balancer.ts > logs/load-balancer.log 2>&1 &
LOAD_BALANCER_PID=$!
echo $LOAD_BALANCER_PID > pids/load-balancer.pid
echo "Load Balancer PID: $LOAD_BALANCER_PID (CPU core: 0)"

# 等待负载均衡器启动
sleep 2

# 启动worker进程，每个绑定到特定CPU核心
for i in $(seq 0 $((MAX_WORKERS-1))); do
    PORT=$((8000 + i))
    
    # 计算CPU核心分配 (跳过核心0，留给负载均衡器)
    CPU_CORE=$(((i + 1) % TOTAL_CPUS))
    
    echo "🚀 Starting Worker $i on port $PORT, CPU core $CPU_CORE..."
    
    # 使用taskset绑定到特定CPU核心，nice降低优先级
    nohup taskset -c $CPU_CORE nice -n 5 deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags=--memory-saver-mode,--max-old-space-size=384,--gc-interval=50 \
        src/server.ts $PORT > logs/server-$PORT.log 2>&1 &
    
    WORKER_PID=$!
    echo $WORKER_PID > pids/worker-$PORT.pid
    echo "Worker $i PID: $WORKER_PID (CPU core: $CPU_CORE)"
    
    # 可选：额外的CPU限制保护
    if command -v cpulimit &> /dev/null; then
        cpulimit -p $WORKER_PID -l 90 &
        echo $! > pids/cpulimit-$PORT.pid
    fi
    
    # 渐进启动，避免同时启动造成的资源竞争
    sleep 0.1
done

echo ""
echo "✅ Multi-Core optimized cluster started successfully!"
echo "📊 Workers: $MAX_WORKERS"
echo "🖥️  CPU cores used: 1-$((MAX_WORKERS % TOTAL_CPUS))"
echo "🌐 Load Balancer: http://localhost:7999 (CPU core 0)"
echo "🧠 Memory per process: 384MB"
echo "🎛️ Process priority: nice +5"
echo "⚡ CPU binding: Each worker on dedicated core"
echo ""

# 显示CPU亲和性映射
echo "📋 CPU Core Assignment:"
echo "  Load Balancer → CPU 0"
for i in $(seq 0 $((MAX_WORKERS-1))); do
    CPU_CORE=$(((i + 1) % TOTAL_CPUS))
    PORT=$((8000 + i))
    echo "  Worker $i (port $PORT) → CPU $CPU_CORE"
done

echo ""
echo "📊 Management Commands:"
echo "  Monitor CPU: bash scripts/monitor-cpu.sh"
echo "  Check cores: bash scripts/check-cpu-distribution.sh"
echo "  Stop:        bash scripts/stop-cluster.sh"
echo "  Status:      bash scripts/cluster-status.sh"
echo ""
echo "🔍 To verify CPU distribution:"
echo "  ps -eo pid,psr,comm,cmd | grep deno"
echo "  (PSR column shows which CPU core each process is using)" 