#!/bin/bash

# Solana Swap Scan Cluster Starter
# 启动30个Deno进程，端口从8000-8030

# 检查是否已安装deno
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install Deno first."
    echo "   curl -fsSL https://deno.land/x/install/install.sh | sh"
    exit 1
fi

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

# 创建日志和PID目录
mkdir -p $LOG_DIR
mkdir -p $PID_DIR

echo -e "${BLUE}🚀 Starting Solana Swap Scan Cluster...${NC}"
echo -e "${YELLOW}   Ports: ${START_PORT}-${END_PORT}${NC}"
echo -e "${YELLOW}   Total processes: $((END_PORT - START_PORT + 1))${NC}"
echo ""

# 清理函数
cleanup() {
    echo -e "\n${RED}🛑 Shutting down cluster...${NC}"
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
for port in $(seq $START_PORT $END_PORT); do
    echo -e "   ${GREEN}Starting server on port $port...${NC}"
    
    # 启动Deno进程
    deno run --allow-net --allow-env --allow-read $SCRIPT_PATH $port \
        > "$LOG_DIR/server-$port.log" 2>&1 &
    
    # 保存PID
    echo $! > "$PID_DIR/server-$port.pid"
    
    # 短暂延迟避免端口冲突
    sleep 0.1
done

echo ""
echo -e "${GREEN}✅ All servers started successfully!${NC}"
echo -e "${BLUE}📊 Process Status:${NC}"

# 等待所有进程启动完成
sleep 2

# 检查进程状态
active_count=0
for port in $(seq $START_PORT $END_PORT); do
    if [ -f "$PID_DIR/server-$port.pid" ]; then
        pid=$(cat "$PID_DIR/server-$port.pid")
        if kill -0 $pid 2>/dev/null; then
            echo -e "   ${GREEN}✓${NC} Port $port - PID: $pid"
            ((active_count++))
        else
            echo -e "   ${RED}✗${NC} Port $port - Failed to start"
        fi
    fi
done

echo ""
echo -e "${BLUE}📈 Summary:${NC}"
echo -e "   Active processes: ${GREEN}$active_count${NC}/$((END_PORT - START_PORT + 1))"
echo -e "   Logs directory: ${YELLOW}$LOG_DIR${NC}"
echo -e "   PID directory: ${YELLOW}$PID_DIR${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   - Check logs: tail -f $LOG_DIR/server-8000.log"
echo -e "   - Health check: curl http://localhost:8000/health"
echo -e "   - Stop all: Ctrl+C or run ./scripts/stop-cluster.sh"
echo ""
echo -e "${GREEN}🎉 Cluster is ready for requests!${NC}"

# 保持脚本运行
wait 