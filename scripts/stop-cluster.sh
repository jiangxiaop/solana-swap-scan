#!/bin/bash

# Solana Swap Scan Cluster Stopper
# 停止所有Deno进程

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
START_PORT=8000
END_PORT=8030
PID_DIR="pids"

echo -e "${RED}🛑 Stopping Solana Swap Scan Cluster...${NC}"

# 检查PID目录是否存在
if [ ! -d "$PID_DIR" ]; then
    echo -e "${YELLOW}⚠️  No PID directory found. Cluster may not be running.${NC}"
    exit 0
fi

stopped_count=0
failed_count=0

# 停止所有进程
for port in $(seq $START_PORT $END_PORT); do
    pid_file="$PID_DIR/server-$port.pid"
    
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        
        if kill -0 $pid 2>/dev/null; then
            echo -e "   ${YELLOW}Stopping process on port $port (PID: $pid)...${NC}"
            
            # 尝试优雅关闭
            if kill -TERM $pid 2>/dev/null; then
                # 等待进程关闭
                for i in {1..5}; do
                    if ! kill -0 $pid 2>/dev/null; then
                        break
                    fi
                    sleep 1
                done
                
                # 如果进程仍在运行，强制关闭
                if kill -0 $pid 2>/dev/null; then
                    echo -e "     ${YELLOW}Force killing process...${NC}"
                    kill -KILL $pid 2>/dev/null
                fi
                
                if ! kill -0 $pid 2>/dev/null; then
                    echo -e "     ${GREEN}✓ Stopped${NC}"
                    ((stopped_count++))
                else
                    echo -e "     ${RED}✗ Failed to stop${NC}"
                    ((failed_count++))
                fi
            else
                echo -e "     ${RED}✗ Failed to send signal${NC}"
                ((failed_count++))
            fi
        else
            echo -e "   ${YELLOW}Process on port $port already stopped${NC}"
            ((stopped_count++))
        fi
        
        # 删除PID文件
        rm -f "$pid_file"
    else
        echo -e "   ${YELLOW}No PID file for port $port${NC}"
    fi
done

# 清理目录
if [ -d "$PID_DIR" ] && [ -z "$(ls -A $PID_DIR)" ]; then
    rmdir "$PID_DIR"
fi

echo ""
echo -e "${BLUE}📈 Summary:${NC}"
echo -e "   Stopped processes: ${GREEN}$stopped_count${NC}"
if [ $failed_count -gt 0 ]; then
    echo -e "   Failed to stop: ${RED}$failed_count${NC}"
fi

echo ""
if [ $failed_count -eq 0 ]; then
    echo -e "${GREEN}✅ All processes stopped successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some processes may still be running. You can check with:${NC}"
    echo -e "   ps aux | grep 'deno.*server.ts'"
    echo -e "   And kill manually if needed: kill -9 <PID>"
fi 