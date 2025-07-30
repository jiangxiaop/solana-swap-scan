#!/bin/bash

# Solana Swap Scan - Real-time CPU Monitor
# 实时监控CPU使用率和进程状态

echo "📊 CPU Monitoring Dashboard"
echo "=========================="
echo ""

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Installing..."
        case $1 in
            htop)
                sudo apt-get update && sudo apt-get install -y htop
                ;;
            iostat)
                sudo apt-get update && sudo apt-get install -y sysstat
                ;;
        esac
    fi
}

# 显示系统CPU信息
show_cpu_info() {
    echo "💻 System Information:"
    echo "  CPU Cores: $(nproc)"
    echo "  CPU Model: $(grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)"
    echo "  Load Average: $(uptime | awk '{print $10 $11 $12}')"
    echo ""
}

# 显示Solana进程CPU使用率
show_solana_processes() {
    echo "🚀 Solana Processes CPU Usage:"
    echo "PID     CPU%  MEM%  CMD"
    echo "--------------------------------"
    
    # 查找所有相关进程并按CPU使用率排序
    ps aux | grep -E "(deno.*server\.ts|load-balancer)" | grep -v grep | \
    awk '{printf "%-8s%-6s%-6s%s\n", $2, $3, $4, $11}' | \
    sort -k2 -nr | head -10
    
    echo ""
}

# 显示系统整体CPU状态
show_system_cpu() {
    echo "🖥️ System CPU Usage:"
    echo "==================="
    
    # 获取CPU使用率
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    
    echo "  Overall CPU: ${CPU_USAGE}%"
    echo "  Memory: ${MEM_USAGE}%"
    echo ""
    
    # 显示每个CPU核心的使用率
    echo "📈 Per-Core CPU Usage:"
    mpstat -P ALL 1 1 | tail -n +4 | head -n $(nproc) | \
    awk '{printf "  Core %s: %s%%\n", $2, 100-$12}'
    echo ""
}

# 检查CPU告警
check_cpu_alerts() {
    echo "⚠️ CPU Alerts:"
    echo "=============="
    
    # 检查高CPU进程
    HIGH_CPU_PROCS=$(ps aux | awk '$3 > 80 {print $2, $3, $11}' | wc -l)
    if [ $HIGH_CPU_PROCS -gt 0 ]; then
        echo "  🔴 $HIGH_CPU_PROCS processes using >80% CPU:"
        ps aux | awk '$3 > 80 {printf "    PID %s: %.1f%% - %s\n", $2, $3, $11}' | head -5
    else
        echo "  ✅ No high CPU usage detected"
    fi
    
    # 检查系统负载
    LOAD_AVG=$(uptime | awk '{print $10}' | cut -d, -f1)
    CPU_CORES=$(nproc)
    if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l) )); then
        echo "  🔴 High system load: $LOAD_AVG (>${CPU_CORES} cores)"
    else
        echo "  ✅ System load normal: $LOAD_AVG"
    fi
    echo ""
}

# 提供优化建议
show_recommendations() {
    echo "💡 Optimization Recommendations:"
    echo "==============================="
    
    TOTAL_PROCS=$(ps aux | grep -E "(deno.*server\.ts)" | grep -v grep | wc -l)
    CPU_CORES=$(nproc)
    
    if [ $TOTAL_PROCS -gt $CPU_CORES ]; then
        echo "  ⚠️ Too many workers ($TOTAL_PROCS) for $CPU_CORES cores"
        echo "    Recommended: $(echo "$CPU_CORES * 0.75" | bc | cut -d. -f1) workers"
    fi
    
    echo "  💡 To reduce CPU usage:"
    echo "    - Use: bash scripts/cpu-optimized-start.sh"
    echo "    - Install cpulimit: sudo apt-get install cpulimit"
    echo "    - Monitor with: watch -n 2 'bash scripts/monitor-cpu.sh'"
    echo ""
}

# 主监控功能
monitor_mode() {
    if [ "$1" = "--watch" ]; then
        echo "🔄 Starting continuous monitoring (Ctrl+C to exit)..."
        echo ""
        while true; do
            clear
            show_cpu_info
            show_system_cpu
            show_solana_processes
            check_cpu_alerts
            echo "⏰ Updated: $(date)"
            echo "Press Ctrl+C to exit"
            sleep 3
        done
    else
        show_cpu_info
        show_system_cpu
        show_solana_processes
        check_cpu_alerts
        show_recommendations
    fi
}

# 命令行参数处理
case "$1" in
    --watch|-w)
        monitor_mode --watch
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --watch, -w    Continuous monitoring mode"
        echo "  --help, -h     Show this help"
        echo ""
        echo "Examples:"
        echo "  $0              # One-time status check"
        echo "  $0 --watch      # Continuous monitoring"
        ;;
    *)
        monitor_mode
        ;;
esac 