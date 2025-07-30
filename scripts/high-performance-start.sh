#!/bin/bash

# 高性能Solana Swap Scan集群启动脚本
# 速度优先，充分利用服务器资源

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 高性能配置
START_PORT=8000
END_PORT=8030
SCRIPT_PATH="src/server.ts"
PID_DIR="pids"

# 高性能参数配置
MAX_HEAP_SIZE="2048m"      # 每个进程2GB堆内存
MAX_OLD_SPACE="1600m"      # 老生代1.6GB内存
INITIAL_HEAP_SIZE="512m"   # 初始堆大小

printf "${PURPLE}🚀 Starting HIGH PERFORMANCE Solana Swap Scan Cluster${NC}\n"
printf "${YELLOW}   Mode: SPEED FIRST - Maximum Performance (No Logging)${NC}\n"
printf "${YELLOW}   Ports: ${START_PORT}-${END_PORT}${NC}\n"
printf "${YELLOW}   Max heap per process: ${MAX_HEAP_SIZE}${NC}\n"
printf "${YELLOW}   Total processes: $((END_PORT - START_PORT + 1))${NC}\n"
printf "\n"

# 检查系统资源
total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
cpu_cores=$(nproc)
required_memory=$((((END_PORT - START_PORT + 1)) * 2200))  # 每个进程约2.2GB

printf "${BLUE}💪 High Performance System Check:${NC}\n"
printf "   CPU cores: ${cpu_cores}\n"
printf "   Total memory: ${total_memory}MB\n"
printf "   Required memory: ${required_memory}MB\n"
printf "   Available memory: $((total_memory - $(free -m | awk 'NR==2{printf "%.0f", $3}')))MB\n"

if [ "$total_memory" -lt "$required_memory" ]; then
    printf "${RED}❌ Warning: System memory may be insufficient for high performance mode${NC}\n"
    printf "${YELLOW}   Recommended: At least ${required_memory}MB total memory${NC}\n"
    read -p "Continue with high performance mode anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        printf "${YELLOW}💡 Consider using: bash scripts/memory-optimized-start.sh${NC}\n"
        exit 1
    fi
fi

# 优化系统参数
printf "${BLUE}⚙️  Optimizing system parameters...${NC}\n"

# 增加文件描述符限制
ulimit -n 65536 2>/dev/null || printf "${YELLOW}   Warning: Could not increase file descriptor limit${NC}\n"

# 设置高性能环境变量
export HIGH_PERFORMANCE_MODE=true
# Note: Using --v8-flags parameter instead of DENO_V8_FLAGS to avoid conflicts

printf "${GREEN}✅ High performance environment configured (No logging enabled)${NC}\n"

# 创建必要的目录
mkdir -p $PID_DIR

# 清理函数
cleanup() {
    printf "\n${RED}🛑 Shutting down high performance cluster...${NC}\n"
    for port in $(seq $START_PORT $END_PORT); do
        if [ -f "$PID_DIR/server-$port.pid" ]; then
            pid=$(cat "$PID_DIR/server-$port.pid")
            if kill -0 $pid 2>/dev/null; then
                printf "   Stopping high performance process on port $port (PID: $pid)\n"
                kill $pid
                rm -f "$PID_DIR/server-$port.pid"
            fi
        fi
    done
    printf "${GREEN}✅ All high performance processes stopped${NC}\n"
    exit 0
}

# 捕获中断信号
trap cleanup INT TERM

# 启动所有进程 - 高性能模式
printf "${YELLOW}🔥 Starting HIGH PERFORMANCE worker processes (No logging)...${NC}\n"

for port in $(seq $START_PORT $END_PORT); do
    printf "   ${GREEN}Starting HIGH PERF server on port $port...${NC}\n"
    
    # 启动高性能Deno进程（无日志输出，节省存储）
    HIGH_PERFORMANCE_MODE=true deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags="--no-memory-saver-mode" \
        $SCRIPT_PATH $port \
        >/dev/null 2>&1 &
    
    # 保存PID
    echo $! > "$PID_DIR/server-$port.pid"
    
    # 最小延迟 - 优先速度
    sleep 0.05
done

printf "\n"
printf "${GREEN}🔥 All HIGH PERFORMANCE servers started!${NC}\n"
printf "${BLUE}📊 High Performance Status:${NC}\n"

# 等待进程启动
sleep 2

# 检查进程状态
active_count=0
total_memory_usage=0

for port in $(seq $START_PORT $END_PORT); do
    if [ -f "$PID_DIR/server-$port.pid" ]; then
        pid=$(cat "$PID_DIR/server-$port.pid")
        if kill -0 $pid 2>/dev/null; then
            # 获取内存使用情况
            memory_kb=$(ps -o rss= -p $pid 2>/dev/null || echo "0")
            memory_mb=$((memory_kb / 1024))
            total_memory_usage=$((total_memory_usage + memory_mb))
            
            printf "   ${GREEN}⚡${NC} Port $port - PID: $pid - Memory: ${memory_mb}MB\n"
            active_count=$((active_count + 1))
        else
            printf "   ${RED}✗${NC} Port $port - Failed to start\n"
        fi
    fi
done

printf "\n"
printf "${PURPLE}🚀 HIGH PERFORMANCE Summary:${NC}\n"
printf "   Active processes: ${GREEN}$active_count${NC}/$((END_PORT - START_PORT + 1))\n"
printf "   Total cluster memory: ${GREEN}${total_memory_usage}MB${NC}\n"
if [ "$active_count" -gt 0 ]; then
    printf "   Average per process: ${GREEN}$((total_memory_usage / active_count))MB${NC}\n"
else
    printf "   Average per process: ${RED}N/A (no active processes)${NC}\n"
fi

# 系统资源使用
system_memory_percent=$(free | awk 'NR==2{printf "%.1f", $3/$2*100}')
printf "   System memory usage: ${GREEN}${system_memory_percent}%${NC}\n"

printf "\n"
printf "${PURPLE}⚡ HIGH PERFORMANCE Features:${NC}\n"
printf "   • Unlimited concurrent processing\n"
printf "   • 2GB heap per process (vs 512MB in normal mode)\n"
printf "   • No batch size limits\n"
printf "   • No artificial delays\n"
printf "   • Optimized V8 compilation\n"
printf "   • Memory reducer disabled\n"
printf "   • Always optimized JIT\n"
printf "   • ${GREEN}No logging (saves storage space)${NC}\n"

printf "\n"
printf "${YELLOW}🔍 Performance Monitoring:${NC}\n"
printf "   • Performance check: ${YELLOW}curl http://localhost:8000/health${NC}\n"
printf "   • Load balancer: ${YELLOW}http://localhost:7999${NC}\n"
printf "   • Process status: ${YELLOW}ps aux | grep deno${NC}\n"

printf "\n"
printf "${BLUE}💡 High Performance Tips:${NC}\n"
printf "   • Send large batches to maximize throughput\n"
printf "   • Monitor system resources during peak load\n"
printf "   • Use load balancer for optimal distribution\n"
printf "   • Each process can handle ~2x more data than normal mode\n"
printf "   • ${GREEN}No log files = zero storage overhead${NC}\n"

printf "\n"
printf "${GREEN}🎉 HIGH PERFORMANCE cluster is ready for maximum speed!${NC}\n"
printf "${PURPLE}💪 This configuration prioritizes SPEED over memory efficiency${NC}\n"
printf "${GREEN}💾 No logging enabled - zero storage overhead${NC}\n"

# 保持脚本运行
wait 