#!/bin/bash

# 内存监控脚本
# 预防性监控和重启高内存使用的进程

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置参数
START_PORT=${START_PORT:-8000}
END_PORT=${END_PORT:-8030}
PID_DIR=${PID_DIR:-"pids"}
LOG_DIR=${LOG_DIR:-"logs"}
MEMORY_THRESHOLD=${MEMORY_THRESHOLD:-3000}  # 3GB内存阈值
CHECK_INTERVAL=${CHECK_INTERVAL:-60}        # 检查间隔（秒）

printf "${BLUE}🔍 启动内存监控程序${NC}\n"
printf "${YELLOW}   内存阈值: ${MEMORY_THRESHOLD}MB${NC}\n"
printf "${YELLOW}   检查间隔: ${CHECK_INTERVAL}秒${NC}\n"
printf "\n"

while true; do
    printf "${BLUE}[$(date '+%H:%M:%S')] 检查内存使用情况...${NC}\n"
    
    for port in $(seq $START_PORT $END_PORT); do
        pid_file="$PID_DIR/server-$port.pid"
        
        if [[ -f "$pid_file" ]]; then
            pid=$(cat "$pid_file" 2>/dev/null)
            if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                # 获取内存使用情况（MB）
                memory_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
                if [[ -n "$memory_kb" && "$memory_kb" != "0" ]]; then
                    memory_mb=$((memory_kb / 1024))
                    
                    if [[ $memory_mb -gt $MEMORY_THRESHOLD ]]; then
                        printf "${RED}⚠️  端口 $port 内存使用过高: ${memory_mb}MB > ${MEMORY_THRESHOLD}MB${NC}\n"
                        printf "${YELLOW}   触发预防性重启...${NC}\n"
                        
                        # 记录到日志
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 端口 $port 内存使用过高: ${memory_mb}MB，触发预防性重启" >> "$LOG_DIR/memory-monitor.log"
                        
                        # 执行重启
                        bash scripts/restart-manager.sh "$port" "high_memory_usage" >/dev/null 2>&1 &
                        
                        # 等待重启完成
                        sleep 10
                    else
                        printf "${GREEN}✅ 端口 $port 内存正常: ${memory_mb}MB${NC}\n"
                    fi
                fi
            fi
        fi
    done
    
    printf "\n"
    sleep "$CHECK_INTERVAL"
done 