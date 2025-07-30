#!/bin/bash

# Solana Swap Scan - Emergency Stop Script
# 紧急停止脚本 - 用于CPU使用率过高时

echo "🚨 EMERGENCY STOP - Solana Swap Scan Cluster"
echo "============================================="
echo ""

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# 检查当前CPU使用率
check_cpu_usage() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo "💻 Current CPU usage: ${CPU_USAGE}%"
    
    if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
        echo -e "${RED}⚠️ HIGH CPU USAGE DETECTED!${NC}"
        return 0
    else
        echo -e "${GREEN}ℹ️ CPU usage is normal${NC}"
        return 1
    fi
}

# 强制终止所有相关进程
force_kill_processes() {
    echo ""
    echo "🔍 Finding Solana processes..."
    
    # 查找所有相关进程
    DENO_PIDS=$(ps aux | grep -E "deno.*server\.ts" | grep -v grep | awk '{print $2}')
    LB_PIDS=$(ps aux | grep -E "load-balancer" | grep -v grep | awk '{print $2}')
    CPULIMIT_PIDS=$(ps aux | grep -E "cpulimit" | grep -v grep | awk '{print $2}')
    
    TOTAL_PROCESSES=0
    
    # 统计进程数量
    for PID in $DENO_PIDS $LB_PIDS $CPULIMIT_PIDS; do
        if [ -n "$PID" ]; then
            TOTAL_PROCESSES=$((TOTAL_PROCESSES + 1))
        fi
    done
    
    if [ $TOTAL_PROCESSES -eq 0 ]; then
        echo -e "${GREEN}✅ No Solana processes found running${NC}"
        return 0
    fi
    
    echo "🎯 Found $TOTAL_PROCESSES processes to terminate"
    echo ""
    
    # 优雅停止 (SIGTERM)
    echo "🛑 Step 1: Graceful shutdown (SIGTERM)..."
    for PID in $DENO_PIDS $LB_PIDS; do
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            echo "  Stopping PID $PID..."
            kill -TERM $PID 2>/dev/null
        fi
    done
    
    # 等待5秒
    echo "⏳ Waiting 5 seconds for graceful shutdown..."
    sleep 5
    
    # 强制停止 (SIGKILL)
    echo "💀 Step 2: Force kill remaining processes..."
    FORCE_KILLED=0
    for PID in $DENO_PIDS $LB_PIDS $CPULIMIT_PIDS; do
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            echo "  Force killing PID $PID..."
            kill -KILL $PID 2>/dev/null
            FORCE_KILLED=$((FORCE_KILLED + 1))
        fi
    done
    
    echo ""
    if [ $FORCE_KILLED -gt 0 ]; then
        echo -e "${YELLOW}⚡ Force killed $FORCE_KILLED stubborn processes${NC}"
    else
        echo -e "${GREEN}✅ All processes stopped gracefully${NC}"
    fi
}

# 清理端口占用
cleanup_ports() {
    echo ""
    echo "🌐 Cleaning up port usage..."
    
    # 检查端口占用
    OCCUPIED_PORTS=0
    for PORT in 7999 {8000..8030}; do
        if lsof -i :$PORT >/dev/null 2>&1; then
            PID=$(lsof -t -i :$PORT 2>/dev/null)
            if [ -n "$PID" ]; then
                echo "  Killing process on port $PORT (PID: $PID)..."
                kill -KILL $PID 2>/dev/null
                OCCUPIED_PORTS=$((OCCUPIED_PORTS + 1))
            fi
        fi
    done
    
    if [ $OCCUPIED_PORTS -eq 0 ]; then
        echo -e "  ${GREEN}✅ All ports are clean${NC}"
    else
        echo -e "  ${YELLOW}⚡ Cleaned $OCCUPIED_PORTS occupied ports${NC}"
    fi
}

# 清理PID文件
cleanup_pid_files() {
    echo ""
    echo "🗂️ Cleaning up PID files..."
    
    if [ -d "pids" ]; then
        PID_COUNT=$(find pids -name "*.pid" 2>/dev/null | wc -l)
        if [ $PID_COUNT -gt 0 ]; then
            rm -f pids/*.pid
            echo "  Removed $PID_COUNT PID files"
        else
            echo "  No PID files to clean"
        fi
    else
        echo "  No pids directory found"
    fi
}

# 显示系统状态
show_final_status() {
    echo ""
    echo "📊 Final System Status:"
    echo "======================"
    
    # CPU使用率
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo "💻 CPU Usage: ${CPU_USAGE}%"
    
    # 内存使用率
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    echo "💾 Memory Usage: ${MEM_USAGE}%"
    
    # 负载平均值
    LOAD_AVG=$(uptime | awk '{print $10}' | cut -d, -f1)
    echo "⚖️ Load Average: ${LOAD_AVG}"
    
    # 检查剩余进程
    REMAINING_PROCS=$(ps aux | grep -E "(deno.*server\.ts|load-balancer)" | grep -v grep | wc -l)
    if [ $REMAINING_PROCS -eq 0 ]; then
        echo -e "🚀 Solana Processes: ${GREEN}0 (All stopped)${NC}"
    else
        echo -e "🚀 Solana Processes: ${RED}$REMAINING_PROCS (Still running!)${NC}"
    fi
    
    echo ""
}

# 提供下一步建议
show_recommendations() {
    echo "💡 Next Steps and Recommendations:"
    echo "=================================="
    echo ""
    echo "🔧 To prevent high CPU usage in the future:"
    echo "  1. Use CPU-optimized mode:"
    echo "     bash scripts/cpu-optimized-start.sh"
    echo ""
    echo "  2. Install CPU limiting tools:"
    echo "     sudo apt-get install cpulimit"
    echo ""
    echo "  3. Monitor before starting:"
    echo "     bash scripts/monitor-cpu.sh --watch"
    echo ""
    echo "🔍 To investigate what caused high CPU:"
    echo "  1. Check recent logs:"
    echo "     bash scripts/cluster-status.sh --logs"
    echo ""
    echo "  2. Review system performance:"
    echo "     bash scripts/performance-comparison.sh"
    echo ""
    echo "⚡ Safe restart options:"
    echo "  - Conservative: bash scripts/memory-optimized-start.sh"
    echo "  - Balanced:     bash scripts/cpu-optimized-start.sh"
    echo "  - High perf:    bash scripts/high-performance-start.sh"
    echo ""
}

# 主函数
main() {
    echo "⏰ Started at: $(date)"
    echo ""
    
    # 检查是否需要紧急停止
    if [ "$1" != "--force" ]; then
        if ! check_cpu_usage; then
            echo ""
            echo -e "${YELLOW}💭 CPU usage is normal. Are you sure you want to emergency stop?${NC}"
            echo "   Use --force to skip this check"
            echo "   Or use regular stop: bash scripts/stop-cluster.sh"
            echo ""
            exit 0
        fi
    fi
    
    echo ""
    echo -e "${RED}🚨 EMERGENCY STOP INITIATED${NC}"
    echo ""
    
    # 执行紧急停止步骤
    force_kill_processes
    cleanup_ports
    cleanup_pid_files
    show_final_status
    show_recommendations
    
    echo ""
    echo -e "${GREEN}✅ Emergency stop completed at $(date)${NC}"
    echo ""
}

# 显示帮助
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Emergency stop script for Solana Swap Scan cluster"
    echo ""
    echo "Options:"
    echo "  --force    Force stop even if CPU usage is normal"
    echo "  --help     Show this help"
    echo ""
    echo "Examples:"
    echo "  $0               # Stop if CPU > 80%"
    echo "  $0 --force       # Force stop regardless of CPU"
    echo ""
    exit 0
fi

main "$@" 