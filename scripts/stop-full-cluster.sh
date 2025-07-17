#!/bin/bash

# Solana Swap Scan Full Cluster Stopper
# 停止完整的集群：负载均衡器 + 所有工作进程

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="pids"

echo -e "${RED}🛑 Stopping Solana Swap Scan Full Cluster...${NC}"

# 1. 停止负载均衡器
echo -e "${YELLOW}📋 Step 1: Stopping Load Balancer...${NC}"

if [ -f "$PID_DIR/load-balancer.pid" ]; then
    lb_pid=$(cat "$PID_DIR/load-balancer.pid")
    
    if kill -0 $lb_pid 2>/dev/null; then
        echo -e "   ${YELLOW}Stopping Load Balancer (PID: $lb_pid)...${NC}"
        
        # 尝试优雅关闭
        if kill -TERM $lb_pid 2>/dev/null; then
            # 等待进程关闭
            for i in {1..5}; do
                if ! kill -0 $lb_pid 2>/dev/null; then
                    break
                fi
                sleep 1
            done
            
            # 如果进程仍在运行，强制关闭
            if kill -0 $lb_pid 2>/dev/null; then
                echo -e "     ${YELLOW}Force killing Load Balancer...${NC}"
                kill -KILL $lb_pid 2>/dev/null
            fi
            
            if ! kill -0 $lb_pid 2>/dev/null; then
                echo -e "   ${GREEN}✓ Load Balancer stopped${NC}"
            else
                echo -e "   ${RED}✗ Failed to stop Load Balancer${NC}"
            fi
        else
            echo -e "   ${RED}✗ Failed to send signal to Load Balancer${NC}"
        fi
    else
        echo -e "   ${YELLOW}Load Balancer already stopped${NC}"
    fi
    
    # 删除PID文件
    rm -f "$PID_DIR/load-balancer.pid"
else
    echo -e "   ${YELLOW}No Load Balancer PID file found${NC}"
fi

# 2. 停止工作进程集群
echo -e "${YELLOW}📋 Step 2: Stopping worker processes...${NC}"
bash "$SCRIPT_DIR/stop-cluster.sh"

# 3. 清理
echo -e "${YELLOW}📋 Step 3: Cleaning up...${NC}"

# 检查并清理任何残留的deno进程
REMAINING_PROCESSES=$(ps aux | grep "deno.*server.ts" | grep -v grep | wc -l)
if [ "$REMAINING_PROCESSES" -gt 0 ]; then
    echo -e "   ${YELLOW}Found $REMAINING_PROCESSES remaining deno processes${NC}"
    echo -e "   ${YELLOW}Cleaning up remaining processes...${NC}"
    
    # 获取所有相关进程的PID
    PIDS=$(ps aux | grep "deno.*server.ts" | grep -v grep | awk '{print $2}')
    
    for pid in $PIDS; do
        if kill -0 $pid 2>/dev/null; then
            echo -e "     ${YELLOW}Killing process $pid...${NC}"
            kill -KILL $pid 2>/dev/null
        fi
    done
    
    sleep 1
    
    # 再次检查
    REMAINING_AFTER_CLEANUP=$(ps aux | grep "deno.*server.ts" | grep -v grep | wc -l)
    if [ "$REMAINING_AFTER_CLEANUP" -eq 0 ]; then
        echo -e "   ${GREEN}✓ All processes cleaned up${NC}"
    else
        echo -e "   ${YELLOW}⚠️  $REMAINING_AFTER_CLEANUP processes still running${NC}"
    fi
else
    echo -e "   ${GREEN}✓ No remaining processes found${NC}"
fi

# 检查并清理负载均衡器进程
LB_PROCESSES=$(ps aux | grep "deno.*load-balancer.ts" | grep -v grep | wc -l)
if [ "$LB_PROCESSES" -gt 0 ]; then
    echo -e "   ${YELLOW}Found $LB_PROCESSES remaining load balancer processes${NC}"
    LB_PIDS=$(ps aux | grep "deno.*load-balancer.ts" | grep -v grep | awk '{print $2}')
    
    for pid in $LB_PIDS; do
        if kill -0 $pid 2>/dev/null; then
            echo -e "     ${YELLOW}Killing load balancer process $pid...${NC}"
            kill -KILL $pid 2>/dev/null
        fi
    done
fi

# 清理空的目录
if [ -d "$PID_DIR" ] && [ -z "$(ls -A $PID_DIR)" ]; then
    rmdir "$PID_DIR"
    echo -e "   ${GREEN}✓ Cleaned up PID directory${NC}"
fi

echo ""
echo -e "${GREEN}✅ Full cluster stopped successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Final Status:${NC}"

# 最终检查
FINAL_DENO_PROCESSES=$(ps aux | grep "deno.*\(server\|load-balancer\)\.ts" | grep -v grep | wc -l)
if [ "$FINAL_DENO_PROCESSES" -eq 0 ]; then
    echo -e "   ${GREEN}✓ No Deno processes running${NC}"
    echo -e "   ${GREEN}✓ All ports should be available${NC}"
    echo -e "   ${GREEN}✓ Ready for fresh start${NC}"
else
    echo -e "   ${YELLOW}⚠️  $FINAL_DENO_PROCESSES Deno processes still running${NC}"
    echo -e "   ${YELLOW}   You may need to manually kill them:${NC}"
    echo -e "   ${YELLOW}   ps aux | grep deno | grep -v grep${NC}"
    echo -e "   ${YELLOW}   kill -9 <PID>${NC}"
fi

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo -e "   ${YELLOW}• To start the cluster again: bash scripts/start-full-cluster.sh${NC}"
echo -e "   ${YELLOW}• To check for any remaining processes: ps aux | grep deno${NC}"
echo -e "   ${YELLOW}• To view logs: ls -la logs/${NC}" 