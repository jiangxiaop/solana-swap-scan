#!/bin/bash

# 高性能集群停止脚本
# 用于强制停止所有相关进程

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

printf "${RED}🛑 强制停止Solana高性能集群${NC}\n"
printf "${YELLOW}   端口范围: $START_PORT-$END_PORT${NC}\n"
printf "\n"

stopped_count=0
total_count=0

# 停止监控守护进程
printf "${BLUE}🔍 停止进程监控守护程序...${NC}\n"
if [[ -f "$PID_DIR/supervisor.pid" ]]; then
    supervisor_pid=$(cat "$PID_DIR/supervisor.pid" 2>/dev/null)
    if [[ -n "$supervisor_pid" ]] && kill -0 "$supervisor_pid" 2>/dev/null; then
        printf "   停止监控进程 (PID: $supervisor_pid)...\n"
        kill -TERM "$supervisor_pid" 2>/dev/null
        sleep 3
        if kill -0 "$supervisor_pid" 2>/dev/null; then
            kill -KILL "$supervisor_pid" 2>/dev/null
        fi
        printf "   ${GREEN}✅ 监控进程已停止${NC}\n"
    else
        printf "   ${YELLOW}⚠️  监控进程不存在或已停止${NC}\n"
    fi
    rm -f "$PID_DIR/supervisor.pid"
else
    printf "   ${YELLOW}⚠️  监控进程PID文件不存在${NC}\n"
fi

# 停止所有服务进程
printf "\n${BLUE}🔥 停止所有高性能服务进程...${NC}\n"
for port in $(seq $START_PORT $END_PORT); do
    total_count=$((total_count + 1))
    
    if [[ -f "$PID_DIR/server-$port.pid" ]]; then
        pid=$(cat "$PID_DIR/server-$port.pid" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            printf "   停止端口 $port 进程 (PID: $pid)...\n"
            
            # 先尝试优雅关闭
            kill -TERM "$pid" 2>/dev/null
            sleep 1
            
            # 如果还在运行，强制杀死
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null
                sleep 0.5
            fi
            
            # 验证是否已停止
            if ! kill -0 "$pid" 2>/dev/null; then
                stopped_count=$((stopped_count + 1))
                printf "     ${GREEN}✅ 已停止${NC}\n"
            else
                printf "     ${RED}❌ 停止失败${NC}\n"
            fi
        else
            printf "   端口 $port: ${YELLOW}进程不存在或已停止${NC}\n"
        fi
        
        # 清理PID文件
        rm -f "$PID_DIR/server-$port.pid"
    else
        printf "   端口 $port: ${YELLOW}PID文件不存在${NC}\n"
    fi
done

# 额外检查：杀死所有相关的deno进程
printf "\n${BLUE}🧹 清理残留的Deno进程...${NC}\n"
deno_pids=$(pgrep -f "deno.*src/server.ts" 2>/dev/null || true)
if [[ -n "$deno_pids" ]]; then
    printf "   发现残留Deno进程: $deno_pids\n"
    for pid in $deno_pids; do
        if kill -0 "$pid" 2>/dev/null; then
            printf "   强制停止残留进程 (PID: $pid)...\n"
            kill -KILL "$pid" 2>/dev/null
        fi
    done
    printf "   ${GREEN}✅ 残留进程清理完成${NC}\n"
else
    printf "   ${GREEN}✅ 无残留Deno进程${NC}\n"
fi

# 清理重启计数文件
printf "\n${BLUE}🧹 清理临时文件...${NC}\n"
restart_count_files=$(ls "$LOG_DIR"/restart_count_* 2>/dev/null | wc -l)
if [[ $restart_count_files -gt 0 ]]; then
    rm -f "$LOG_DIR"/restart_count_*
    printf "   ${GREEN}✅ 已清理 $restart_count_files 个重启计数文件${NC}\n"
else
    printf "   ${GREEN}✅ 无重启计数文件需要清理${NC}\n"
fi

# 检查端口占用情况
printf "\n${BLUE}🔍 检查端口占用情况...${NC}\n"
occupied_ports=0
for port in $(seq $START_PORT $END_PORT); do
    if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        occupied_port_pid=$(lsof -ti:$port 2>/dev/null || echo "unknown")
        printf "   ${YELLOW}⚠️  端口 $port 仍被占用 (PID: $occupied_port_pid)${NC}\n"
        occupied_ports=$((occupied_ports + 1))
    fi
done

if [[ $occupied_ports -eq 0 ]]; then
    printf "   ${GREEN}✅ 所有端口已释放${NC}\n"
else
    printf "   ${RED}❌ $occupied_ports 个端口仍被占用${NC}\n"
fi

# 显示停止统计
printf "\n${PURPLE}📊 停止操作统计:${NC}\n"
printf "   总进程数: $total_count\n"
printf "   成功停止: ${GREEN}$stopped_count${NC}\n"
printf "   失败/不存在: ${YELLOW}$((total_count - stopped_count))${NC}\n"

if [[ $stopped_count -eq $total_count && $occupied_ports -eq 0 ]]; then
    printf "\n${GREEN}🎉 高性能集群已完全停止！${NC}\n"
    exit_code=0
else
    printf "\n${YELLOW}⚠️  集群停止完成，但可能存在部分问题${NC}\n"
    printf "\n${BLUE}💡 如果仍有端口被占用，可以使用以下命令:${NC}\n"
    printf "   sudo netstat -tulpn | grep :80\n"
    printf "   sudo kill -9 <PID>\n"
    exit_code=1
fi

printf "\n${BLUE}📝 查看相关日志:${NC}\n"
printf "   监控日志: ${YELLOW}tail -20 $LOG_DIR/supervisor.log${NC}\n"
printf "   重启历史: ${YELLOW}tail -20 $LOG_DIR/restart.log${NC}\n"

exit $exit_code