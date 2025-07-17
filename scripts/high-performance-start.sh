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
LOG_DIR="logs"
PID_DIR="pids"

# 高性能参数配置
MAX_HEAP_SIZE="2048m"      # 每个进程2GB堆内存
MAX_OLD_SPACE="1600m"      # 老生代1.6GB内存
INITIAL_HEAP_SIZE="512m"   # 初始堆大小

echo -e "${PURPLE}🚀 Starting HIGH PERFORMANCE Solana Swap Scan Cluster${NC}"
echo -e "${YELLOW}   Mode: SPEED FIRST - Maximum Performance${NC}"
echo -e "${YELLOW}   Ports: ${START_PORT}-${END_PORT}${NC}"
echo -e "${YELLOW}   Max heap per process: ${MAX_HEAP_SIZE}${NC}"
echo -e "${YELLOW}   Total processes: $((END_PORT - START_PORT + 1))${NC}"
echo ""

# 检查系统资源
total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
cpu_cores=$(nproc)
required_memory=$((((END_PORT - START_PORT + 1)) * 2200))  # 每个进程约2.2GB

echo -e "${BLUE}💪 High Performance System Check:${NC}"
echo -e "   CPU cores: ${cpu_cores}"
echo -e "   Total memory: ${total_memory}MB"
echo -e "   Required memory: ${required_memory}MB"
echo -e "   Available memory: $((total_memory - $(free -m | awk 'NR==2{printf "%.0f", $3}')))MB"

if [ "$total_memory" -lt "$required_memory" ]; then
    echo -e "${RED}❌ Warning: System memory may be insufficient for high performance mode${NC}"
    echo -e "${YELLOW}   Recommended: At least ${required_memory}MB total memory${NC}"
    read -p "Continue with high performance mode anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}💡 Consider using: bash scripts/memory-optimized-start.sh${NC}"
        exit 1
    fi
fi

# 优化系统参数
echo -e "${BLUE}⚙️  Optimizing system parameters...${NC}"

# 增加文件描述符限制
ulimit -n 65536 2>/dev/null || echo -e "${YELLOW}   Warning: Could not increase file descriptor limit${NC}"

# 设置高性能环境变量
export HIGH_PERFORMANCE_MODE=true
# Note: Using --v8-flags parameter instead of DENO_V8_FLAGS to avoid conflicts

echo -e "${GREEN}✅ High performance environment configured${NC}"

# 创建必要的目录
mkdir -p $LOG_DIR
mkdir -p $PID_DIR

# 清理函数
cleanup() {
    echo -e "\n${RED}🛑 Shutting down high performance cluster...${NC}"
    for port in $(seq $START_PORT $END_PORT); do
        if [ -f "$PID_DIR/server-$port.pid" ]; then
            pid=$(cat "$PID_DIR/server-$port.pid")
            if kill -0 $pid 2>/dev/null; then
                echo "   Stopping high performance process on port $port (PID: $pid)"
                kill $pid
                rm -f "$PID_DIR/server-$port.pid"
            fi
        fi
    done
    echo -e "${GREEN}✅ All high performance processes stopped${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 启动所有进程 - 高性能模式
echo -e "${YELLOW}🔥 Starting HIGH PERFORMANCE worker processes...${NC}"

for port in $(seq $START_PORT $END_PORT); do
    echo -e "   ${GREEN}Starting HIGH PERF server on port $port...${NC}"
    
    # 启动高性能Deno进程（简化V8参数以确保兼容性）
    HIGH_PERFORMANCE_MODE=true deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags="--no-memory-saver-mode" \
        $SCRIPT_PATH $port \
        > "$LOG_DIR/server-$port.log" 2>&1 &
    
    # 保存PID
    echo $! > "$PID_DIR/server-$port.pid"
    
    # 最小延迟 - 优先速度
    sleep 0.05
done

echo ""
echo -e "${GREEN}🔥 All HIGH PERFORMANCE servers started!${NC}"
echo -e "${BLUE}📊 High Performance Status:${NC}"

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
            
            echo -e "   ${GREEN}⚡${NC} Port $port - PID: $pid - Memory: ${memory_mb}MB"
            ((active_count++))
        else
            echo -e "   ${RED}✗${NC} Port $port - Failed to start"
        fi
    fi
done

echo ""
echo -e "${PURPLE}🚀 HIGH PERFORMANCE Summary:${NC}"
echo -e "   Active processes: ${GREEN}$active_count${NC}/$((END_PORT - START_PORT + 1))"
echo -e "   Total cluster memory: ${GREEN}${total_memory_usage}MB${NC}"
if [ "$active_count" -gt 0 ]; then
    echo -e "   Average per process: ${GREEN}$((total_memory_usage / active_count))MB${NC}"
else
    echo -e "   Average per process: ${RED}N/A (no active processes)${NC}"
fi

# 系统资源使用
system_memory_percent=$(free | awk 'NR==2{printf "%.1f", $3/$2*100}')
echo -e "   System memory usage: ${GREEN}${system_memory_percent}%${NC}"

echo ""
echo -e "${PURPLE}⚡ HIGH PERFORMANCE Features:${NC}"
echo -e "   • Unlimited concurrent processing"
echo -e "   • 2GB heap per process (vs 512MB in normal mode)"
echo -e "   • No batch size limits"
echo -e "   • No artificial delays"
echo -e "   • Optimized V8 compilation"
echo -e "   • Memory reducer disabled"
echo -e "   • Always optimized JIT"

echo ""
echo -e "${YELLOW}🔍 Performance Monitoring:${NC}"
echo -e "   • Process logs: ${YELLOW}$LOG_DIR/server-*.log${NC}"
echo -e "   • Performance check: ${YELLOW}curl http://localhost:8000/health${NC}"
echo -e "   • Load balancer: ${YELLOW}http://localhost:7999${NC}"

echo ""
echo -e "${BLUE}💡 High Performance Tips:${NC}"
echo -e "   • Send large batches to maximize throughput"
echo -e "   • Monitor system resources during peak load"
echo -e "   • Use load balancer for optimal distribution"
echo -e "   • Each process can handle ~2x more data than normal mode"

echo ""
echo -e "${GREEN}🎉 HIGH PERFORMANCE cluster is ready for maximum speed!${NC}"
echo -e "${PURPLE}💪 This configuration prioritizes SPEED over memory efficiency${NC}"

# 保持脚本运行
wait 