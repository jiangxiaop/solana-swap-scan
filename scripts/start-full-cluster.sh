#!/bin/bash

# Solana Swap Scan Full Cluster Starter
# 启动完整的集群：负载均衡器 + 30个工作进程

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置
LOAD_BALANCER_PORT=7999
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="logs"
PID_DIR="pids"

echo -e "${PURPLE}🚀 Starting Solana Swap Scan Full Cluster...${NC}"
echo -e "${BLUE}   Load Balancer: port ${LOAD_BALANCER_PORT}${NC}"
echo -e "${BLUE}   Worker processes: ports 8000-8030${NC}"
echo ""

# 检查是否已安装deno
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno is not installed. Please install Deno first.${NC}"
    echo -e "${YELLOW}   curl -fsSL https://deno.land/x/install/install.sh | sh${NC}"
    exit 1
fi

# 创建必要的目录
mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"

# 清理函数
cleanup() {
    echo -e "\n${RED}🛑 Shutting down full cluster...${NC}"
    
    # 停止负载均衡器
    if [ -f "$PID_DIR/load-balancer.pid" ]; then
        lb_pid=$(cat "$PID_DIR/load-balancer.pid")
        if kill -0 $lb_pid 2>/dev/null; then
            echo -e "   ${YELLOW}Stopping Load Balancer (PID: $lb_pid)...${NC}"
            kill $lb_pid
            rm -f "$PID_DIR/load-balancer.pid"
        fi
    fi
    
    # 停止工作进程
    echo -e "   ${YELLOW}Stopping worker processes...${NC}"
    bash "$SCRIPT_DIR/stop-cluster.sh"
    
    echo -e "${GREEN}✅ Full cluster stopped${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 1. 启动工作进程集群
echo -e "${YELLOW}📋 Step 1: Starting worker processes...${NC}"
bash "$SCRIPT_DIR/start-cluster.sh" &
CLUSTER_PID=$!

# 等待工作进程启动
echo -e "   ${BLUE}Waiting for worker processes to start...${NC}"
sleep 5

# 检查集群是否启动成功
if ! kill -0 $CLUSTER_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start worker cluster${NC}"
    exit 1
fi

# 2. 启动负载均衡器
echo -e "${YELLOW}📋 Step 2: Starting Load Balancer...${NC}"
cd "$PROJECT_ROOT"

deno run --allow-net --allow-env load-balancer.ts $LOAD_BALANCER_PORT \
    > "$LOG_DIR/load-balancer.log" 2>&1 &

LB_PID=$!
echo $LB_PID > "$PID_DIR/load-balancer.pid"

# 等待负载均衡器启动
sleep 3

# 检查负载均衡器是否启动成功
if ! kill -0 $LB_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start Load Balancer${NC}"
    cleanup
    exit 1
fi

echo -e "   ${GREEN}✓ Load Balancer started on port $LOAD_BALANCER_PORT (PID: $LB_PID)${NC}"

# 3. 健康检查
echo -e "${YELLOW}📋 Step 3: Performing health checks...${NC}"
sleep 2

# 检查负载均衡器健康状态
echo -e "   ${BLUE}Checking Load Balancer health...${NC}"
if curl -s "http://localhost:$LOAD_BALANCER_PORT/lb-health" > /dev/null; then
    echo -e "   ${GREEN}✓ Load Balancer is healthy${NC}"
else
    echo -e "   ${RED}✗ Load Balancer health check failed${NC}"
fi

# 检查负载均衡器状态
echo -e "   ${BLUE}Getting cluster status...${NC}"
STATUS=$(curl -s "http://localhost:$LOAD_BALANCER_PORT/lb-status" 2>/dev/null)
if [ $? -eq 0 ]; then
    HEALTHY_SERVERS=$(echo "$STATUS" | grep -o '"healthyServers":[0-9]*' | cut -d':' -f2)
    TOTAL_SERVERS=$(echo "$STATUS" | grep -o '"totalServers":[0-9]*' | cut -d':' -f2)
    echo -e "   ${GREEN}✓ Healthy servers: ${HEALTHY_SERVERS}/${TOTAL_SERVERS}${NC}"
else
    echo -e "   ${YELLOW}⚠️  Could not get cluster status${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Full Cluster is ready!${NC}"
echo ""
echo -e "${BLUE}📊 Cluster Information:${NC}"
echo -e "   ${YELLOW}Load Balancer:${NC} http://localhost:$LOAD_BALANCER_PORT"
echo -e "   ${YELLOW}API Endpoint:${NC} http://localhost:$LOAD_BALANCER_PORT/api/parse-blockdata"
echo -e "   ${YELLOW}Health Check:${NC} http://localhost:$LOAD_BALANCER_PORT/lb-health"
echo -e "   ${YELLOW}Status:${NC} http://localhost:$LOAD_BALANCER_PORT/lb-status"
echo ""
echo -e "${BLUE}📁 Log Files:${NC}"
echo -e "   ${YELLOW}Load Balancer:${NC} $LOG_DIR/load-balancer.log"
echo -e "   ${YELLOW}Worker Logs:${NC} $LOG_DIR/server-*.log"
echo ""
echo -e "${BLUE}💡 Usage Examples:${NC}"
echo -e "${YELLOW}   # Test the API${NC}"
echo -e "   curl -X POST http://localhost:$LOAD_BALANCER_PORT/api/parse-blockdata \\"
echo -e "        -H \"Content-Type: application/json\" \\"
echo -e "        -d '[{\"blocknum\": 12345, \"blockdata\": {...}}]'"
echo ""
echo -e "${YELLOW}   # Check cluster status${NC}"
echo -e "   curl http://localhost:$LOAD_BALANCER_PORT/lb-status"
echo ""
echo -e "${YELLOW}   # Monitor logs${NC}"
echo -e "   tail -f $LOG_DIR/load-balancer.log"
echo -e "   tail -f $LOG_DIR/server-8000.log"
echo ""
echo -e "${RED}   # Stop cluster${NC}"
echo -e "   Ctrl+C or run: bash scripts/stop-full-cluster.sh"
echo ""

# 保持脚本运行
wait $CLUSTER_PID 