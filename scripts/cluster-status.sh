#!/bin/bash

# Solana Swap Scan - Cluster Status Monitor
# 集群状态监控和管理

echo "🔍 Solana Swap Scan - Cluster Status"
echo "===================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查端口占用情况
check_port_usage() {
    echo "🌐 Port Usage Status:"
    echo "===================="
    
    # 检查负载均衡器
    if lsof -i :7999 >/dev/null 2>&1; then
        LB_PID=$(lsof -t -i :7999)
        echo -e "  ${GREEN}✅ Load Balancer (7999): Running (PID: $LB_PID)${NC}"
    else
        echo -e "  ${RED}❌ Load Balancer (7999): Not running${NC}"
    fi
    
    # 检查worker端口
    RUNNING_WORKERS=0
    TOTAL_WORKERS=0
    echo ""
    echo "🚀 Worker Status:"
    for PORT in {8000..8030}; do
        TOTAL_WORKERS=$((TOTAL_WORKERS + 1))
        if lsof -i :$PORT >/dev/null 2>&1; then
            WORKER_PID=$(lsof -t -i :$PORT)
            RUNNING_WORKERS=$((RUNNING_WORKERS + 1))
            echo -e "  ${GREEN}✅ Worker $PORT: Running (PID: $WORKER_PID)${NC}"
        else
            echo -e "  ${RED}❌ Worker $PORT: Not running${NC}"
        fi
    done
    
    echo ""
    echo "📊 Summary: $RUNNING_WORKERS/$TOTAL_WORKERS workers running"
    echo ""
}

# 检查进程资源使用
check_resource_usage() {
    echo "📈 Resource Usage:"
    echo "=================="
    
    # 系统整体状态
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    LOAD_AVG=$(uptime | awk '{print $10}' | cut -d, -f1)
    
    echo "  🖥️ System CPU: ${CPU_USAGE}%"
    echo "  💾 System Memory: ${MEM_USAGE}%"
    echo "  ⚖️ Load Average: ${LOAD_AVG}"
    echo ""
    
    # Solana进程资源使用
    echo "🚀 Solana Processes:"
    echo "PID     CPU%  MEM%  RSS(MB) PORT  STATUS"
    echo "-------------------------------------------"
    
    ps aux | grep -E "(deno.*server\.ts|load-balancer)" | grep -v grep | \
    while read line; do
        PID=$(echo $line | awk '{print $2}')
        CPU=$(echo $line | awk '{print $3}')
        MEM=$(echo $line | awk '{print $4}')
        RSS=$(echo $line | awk '{print $6}')
        CMD=$(echo $line | awk '{print $11}')
        
        # 计算MB
        RSS_MB=$(echo "$RSS / 1024" | bc)
        
        # 判断是什么进程
        if echo $CMD | grep -q "load-balancer"; then
            TYPE="LB"
            PORT="7999"
        else
            PORT=$(echo $line | grep -oE "80[0-9][0-9]" | tail -1)
            TYPE="Worker"
        fi
        
        # 状态判断
        if (( $(echo "$CPU > 80" | bc -l) )); then
            STATUS="${RED}HIGH CPU${NC}"
        elif (( $(echo "$MEM > 10" | bc -l) )); then
            STATUS="${YELLOW}HIGH MEM${NC}"
        else
            STATUS="${GREEN}OK${NC}"
        fi
        
        printf "%-8s%-6s%-6s%-8s%-6s%b\n" "$PID" "$CPU" "$MEM" "$RSS_MB" "$PORT" "$STATUS"
    done
    echo ""
}

# 检查日志中的错误
check_logs() {
    echo "📝 Recent Log Analysis:"
    echo "======================"
    
    if [ -d "logs" ]; then
        # 检查最近的错误
        ERROR_COUNT=$(find logs -name "*.log" -mtime -1 -exec grep -i "error\|exception\|failed" {} \; 2>/dev/null | wc -l)
        
        if [ $ERROR_COUNT -gt 0 ]; then
            echo -e "  ${YELLOW}⚠️ Found $ERROR_COUNT errors in recent logs${NC}"
            echo "  Recent errors:"
            find logs -name "*.log" -mtime -1 -exec grep -i "error\|exception\|failed" {} \; 2>/dev/null | tail -5 | \
            while read error; do
                echo "    - $error"
            done
        else
            echo -e "  ${GREEN}✅ No errors found in recent logs${NC}"
        fi
        
        # 检查日志大小
        LARGE_LOGS=$(find logs -name "*.log" -size +10M 2>/dev/null | wc -l)
        if [ $LARGE_LOGS -gt 0 ]; then
            echo -e "  ${YELLOW}⚠️ $LARGE_LOGS log files > 10MB (consider rotation)${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠️ No logs directory found${NC}"
    fi
    echo ""
}

# 提供管理建议和命令
show_management_options() {
    echo "🛠️ Management Options:"
    echo "====================="
    
    # 检查当前状态并提供建议
    RUNNING_WORKERS=$(lsof -i :8000-8030 2>/dev/null | wc -l)
    LB_RUNNING=$(lsof -i :7999 >/dev/null 2>&1 && echo "yes" || echo "no")
    
    echo "📋 Available Commands:"
    
    if [ "$LB_RUNNING" = "no" ] && [ $RUNNING_WORKERS -eq 0 ]; then
        echo -e "  ${GREEN}🚀 Start cluster:${NC}"
        echo "    bash scripts/cpu-optimized-start.sh    # CPU优化模式"
        echo "    bash scripts/high-performance-start.sh  # 高性能模式"
        echo "    bash scripts/memory-optimized-start.sh  # 内存优化模式"
    else
        echo -e "  ${YELLOW}🛑 Stop cluster:${NC}"
        echo "    bash scripts/stop-cluster.sh"
        echo ""
        echo -e "  ${BLUE}🔄 Restart cluster:${NC}"
        echo "    bash scripts/stop-cluster.sh && bash scripts/cpu-optimized-start.sh"
    fi
    
    echo ""
    echo -e "  ${BLUE}📊 Monitoring:${NC}"
    echo "    bash scripts/monitor-cpu.sh --watch"
    echo "    bash scripts/monitor-memory.sh"
    echo "    bash scripts/cluster-status.sh"
    
    echo ""
    echo -e "  ${BLUE}🧪 Testing:${NC}"
    echo "    bash scripts/benchmark-cluster.sh"
    echo "    bash scripts/test-cluster.sh"
    
    # CPU优化建议
    CPU_CORES=$(nproc)
    if [ $RUNNING_WORKERS -gt $CPU_CORES ]; then
        echo ""
        echo -e "  ${YELLOW}💡 Optimization Suggestion:${NC}"
        echo "    Too many workers ($RUNNING_WORKERS) for $CPU_CORES CPU cores"
        echo "    Consider using: bash scripts/cpu-optimized-start.sh"
    fi
    
    echo ""
}

# 快速健康检查
health_check() {
    echo "🏥 Quick Health Check:"
    echo "====================="
    
    ISSUES=0
    
    # CPU检查
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if (( $(echo "$CPU_USAGE > 90" | bc -l) )); then
        echo -e "  ${RED}❌ High CPU usage: ${CPU_USAGE}%${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${GREEN}✅ CPU usage normal: ${CPU_USAGE}%${NC}"
    fi
    
    # 内存检查
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$MEM_USAGE > 85" | bc -l) )); then
        echo -e "  ${RED}❌ High memory usage: ${MEM_USAGE}%${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${GREEN}✅ Memory usage normal: ${MEM_USAGE}%${NC}"
    fi
    
    # 负载检查
    LOAD_AVG=$(uptime | awk '{print $10}' | cut -d, -f1)
    CPU_CORES=$(nproc)
    if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l) )); then
        echo -e "  ${RED}❌ High system load: ${LOAD_AVG} (>${CPU_CORES} cores)${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${GREEN}✅ System load normal: ${LOAD_AVG}${NC}"
    fi
    
    # 磁盘空间检查
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
    if [ $DISK_USAGE -gt 85 ]; then
        echo -e "  ${RED}❌ Low disk space: ${DISK_USAGE}% used${NC}"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${GREEN}✅ Disk space OK: ${DISK_USAGE}% used${NC}"
    fi
    
    echo ""
    if [ $ISSUES -eq 0 ]; then
        echo -e "  ${GREEN}🎉 All systems healthy!${NC}"
    else
        echo -e "  ${RED}⚠️ Found $ISSUES issues that need attention${NC}"
    fi
    echo ""
}

# 主函数
main() {
    case "$1" in
        --health|-h)
            health_check
            ;;
        --ports|-p)
            check_port_usage
            ;;
        --resources|-r)
            check_resource_usage
            ;;
        --logs|-l)
            check_logs
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --health, -h      Quick health check"
            echo "  --ports, -p       Check port usage"
            echo "  --resources, -r   Check resource usage"
            echo "  --logs, -l        Check logs for errors"
            echo "  --help            Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                # Full status report"
            echo "  $0 --health       # Quick health check only"
            ;;
        *)
            health_check
            check_port_usage
            check_resource_usage
            check_logs
            show_management_options
            ;;
    esac
}

main "$@" 