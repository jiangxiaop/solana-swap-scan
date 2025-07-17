#!/bin/bash

# 内存优化的Solana Swap Scan集群启动脚本
# 使用更好的内存管理参数和监控

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
START_PORT=8000
END_PORT=8030
SCRIPT_PATH="src/server.ts"
LOG_DIR="logs"
PID_DIR="pids"

# 内存优化配置
MAX_HEAP_SIZE="512m"    # 每个进程最大堆内存
MAX_OLD_SPACE="400m"    # 老生代最大内存
GC_INTERVAL="--gc-interval=100"  # GC间隔

echo -e "${BLUE}🚀 Starting Memory-Optimized Solana Swap Scan Cluster...${NC}"
echo -e "${YELLOW}   Ports: ${START_PORT}-${END_PORT}${NC}"
echo -e "${YELLOW}   Max heap per process: ${MAX_HEAP_SIZE}${NC}"
echo -e "${YELLOW}   Total processes: $((END_PORT - START_PORT + 1))${NC}"
echo ""

# 检查是否已安装deno
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno is not installed. Please install Deno first.${NC}"
    echo -e "${YELLOW}   curl -fsSL https://deno.land/x/install/install.sh | sh${NC}"
    exit 1
fi

# 检查系统内存
total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
required_memory=$((((END_PORT - START_PORT + 1)) * 600))  # 每个进程约600MB

echo -e "${BLUE}📊 System Memory Check:${NC}"
echo -e "   Total memory: ${total_memory}MB"
echo -e "   Required memory: ${required_memory}MB"
echo -e "   Available memory: $((total_memory - $(free -m | awk 'NR==2{printf "%.0f", $3}')))MB"

if [ "$total_memory" -lt "$required_memory" ]; then
    echo -e "${YELLOW}⚠️  Warning: System memory may be insufficient${NC}"
    echo -e "${YELLOW}   Consider reducing the number of processes${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建必要的目录
mkdir -p $LOG_DIR
mkdir -p $PID_DIR

# 清理函数
cleanup() {
    echo -e "\n${RED}🛑 Shutting down optimized cluster...${NC}"
    for port in $(seq $START_PORT $END_PORT); do
        if [ -f "$PID_DIR/server-$port.pid" ]; then
            pid=$(cat "$PID_DIR/server-$port.pid")
            if kill -0 $pid 2>/dev/null; then
                echo "   Stopping process on port $port (PID: $pid)"
                kill $pid
                rm -f "$PID_DIR/server-$port.pid"
            fi
        fi
    done
    echo -e "${GREEN}✅ All processes stopped${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 启动所有进程
echo -e "${YELLOW}🔧 Starting optimized worker processes...${NC}"

for port in $(seq $START_PORT $END_PORT); do
    echo -e "   ${GREEN}Starting optimized server on port $port...${NC}"
    
    # 启动内存优化的Deno进程
    deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags="--memory-saver-mode" \
        $SCRIPT_PATH $port \
        > "$LOG_DIR/server-$port.log" 2>&1 &
    
    # 保存PID
    echo $! > "$PID_DIR/server-$port.pid"
    
    # 短暂延迟避免系统负载过高
    sleep 0.2
done

echo ""
echo -e "${GREEN}✅ All servers started with memory optimization!${NC}"
echo -e "${BLUE}📊 Process Status:${NC}"

# 等待所有进程启动完成
sleep 3

# 检查进程状态和内存使用
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
            
            echo -e "   ${GREEN}✓${NC} Port $port - PID: $pid - Memory: ${memory_mb}MB"
            ((active_count++))
        else
            echo -e "   ${RED}✗${NC} Port $port - Failed to start"
        fi
    fi
done

echo ""
echo -e "${BLUE}📈 Memory Summary:${NC}"
echo -e "   Active processes: ${GREEN}$active_count${NC}/$((END_PORT - START_PORT + 1))"
echo -e "   Total cluster memory: ${GREEN}${total_memory_usage}MB${NC}"
if [ "$active_count" -gt 0 ]; then
    echo -e "   Average per process: ${GREEN}$((total_memory_usage / active_count))MB${NC}"
else
    echo -e "   Average per process: ${RED}N/A (no active processes)${NC}"
fi

# 系统内存使用
system_memory_percent=$(free | awk 'NR==2{printf "%.1f", $3/$2*100}')
echo -e "   System memory usage: ${GREEN}${system_memory_percent}%${NC}"

echo ""
echo -e "${BLUE}🔍 Memory Monitoring:${NC}"
echo -e "   • Real-time monitoring: ${YELLOW}bash scripts/monitor-memory.sh${NC}"
echo -e "   • Memory logs: ${YELLOW}$LOG_DIR/memory-monitor.log${NC}"
echo -e "   • Process logs: ${YELLOW}$LOG_DIR/server-*.log${NC}"

echo ""
echo -e "${BLUE}💡 Memory Optimization Features:${NC}"
echo -e "   • Heap size limited to ${MAX_HEAP_SIZE} per process"
echo -e "   • Optimized V8 garbage collection"
echo -e "   • Memory reducer enabled"
echo -e "   • Size-optimized compilation"

echo ""
echo -e "${YELLOW}⚙️  Optional: Start memory monitor in background?${NC}"
read -p "Start memory monitor? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔍 Starting memory monitor...${NC}"
    bash scripts/monitor-memory.sh > "$LOG_DIR/memory-monitor-output.log" 2>&1 &
    MONITOR_PID=$!
    echo $MONITOR_PID > "$PID_DIR/memory-monitor.pid"
    echo -e "${GREEN}✅ Memory monitor started (PID: $MONITOR_PID)${NC}"
    echo -e "${YELLOW}   Monitor output: $LOG_DIR/memory-monitor-output.log${NC}"
    
    # 修改清理函数以包含监控进程
    cleanup() {
        echo -e "\n${RED}🛑 Shutting down optimized cluster...${NC}"
        
        # 停止内存监控
        if [ -f "$PID_DIR/memory-monitor.pid" ]; then
            monitor_pid=$(cat "$PID_DIR/memory-monitor.pid")
            if kill -0 $monitor_pid 2>/dev/null; then
                echo "   Stopping memory monitor (PID: $monitor_pid)"
                kill $monitor_pid
                rm -f "$PID_DIR/memory-monitor.pid"
            fi
        fi
        
        # 停止工作进程
        for port in $(seq $START_PORT $END_PORT); do
            if [ -f "$PID_DIR/server-$port.pid" ]; then
                pid=$(cat "$PID_DIR/server-$port.pid")
                if kill -0 $pid 2>/dev/null; then
                    echo "   Stopping process on port $port (PID: $pid)"
                    kill $pid
                    rm -f "$PID_DIR/server-$port.pid"
                fi
            fi
        done
        echo -e "${GREEN}✅ All processes stopped${NC}"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
fi

echo ""
echo -e "${GREEN}🎉 Memory-optimized cluster is ready!${NC}"
echo -e "${YELLOW}💡 Tips for best performance:${NC}"
echo -e "   • Monitor memory usage regularly"
echo -e "   • Restart cluster if memory usage grows too high"
echo -e "   • Adjust batch sizes based on memory usage"
echo -e "   • Use load balancer on port 7999 for requests"

# 保持脚本运行
wait 