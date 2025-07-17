#!/bin/bash

# 内存监控脚本
# 监控Solana Swap Scan集群的内存使用情况

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置
MONITOR_INTERVAL=5  # 监控间隔（秒）
MEMORY_THRESHOLD=80 # 内存警告阈值（百分比）
LOG_FILE="logs/memory-monitor.log"

# 创建日志目录
mkdir -p logs

echo -e "${BLUE}🔍 Starting Memory Monitor for Solana Swap Scan Cluster${NC}"
echo -e "${YELLOW}   Monitor interval: ${MONITOR_INTERVAL}s${NC}"
echo -e "${YELLOW}   Memory threshold: ${MEMORY_THRESHOLD}%${NC}"
echo -e "${YELLOW}   Log file: ${LOG_FILE}${NC}"
echo ""

# 获取系统信息
get_system_info() {
    local total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    local used_mem=$(free -m | awk 'NR==2{printf "%.0f", $3}')
    local free_mem=$(free -m | awk 'NR==2{printf "%.0f", $4}')
    local mem_percent=$(awk "BEGIN {printf \"%.1f\", $used_mem/$total_mem*100}")
    
    echo "$total_mem,$used_mem,$free_mem,$mem_percent"
}

# 获取Deno进程信息
get_deno_processes() {
    local processes=$(ps aux | grep "deno.*\(server\|load-balancer\)\.ts" | grep -v grep)
    echo "$processes"
}

# 分析内存使用
analyze_memory() {
    local deno_processes="$1"
    local total_rss=0
    local total_vsz=0
    local process_count=0
    
    if [ -n "$deno_processes" ]; then
        while IFS= read -r line; do
            if [ -n "$line" ]; then
                local rss=$(echo "$line" | awk '{print $6}')
                local vsz=$(echo "$line" | awk '{print $5}')
                local pid=$(echo "$line" | awk '{print $2}')
                local cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i}')
                
                # 转换为MB
                rss_mb=$((rss / 1024))
                vsz_mb=$((vsz / 1024))
                
                total_rss=$((total_rss + rss_mb))
                total_vsz=$((total_vsz + vsz_mb))
                process_count=$((process_count + 1))
                
                echo "   PID: $pid | RSS: ${rss_mb}MB | VSZ: ${vsz_mb}MB | CMD: $cmd"
            fi
        done <<< "$deno_processes"
    fi
    
    echo "$total_rss,$total_vsz,$process_count"
}

# 检查内存警告
check_memory_warning() {
    local mem_percent="$1"
    local total_rss="$2"
    local process_count="$3"
    
    local warning_level=0
    
    if (( $(echo "$mem_percent > $MEMORY_THRESHOLD" | bc -l) )); then
        warning_level=2
        echo -e "${RED}⚠️  HIGH MEMORY USAGE: ${mem_percent}% (threshold: ${MEMORY_THRESHOLD}%)${NC}"
    elif (( $(echo "$mem_percent > $(($MEMORY_THRESHOLD - 20))" | bc -l) )); then
        warning_level=1
        echo -e "${YELLOW}⚠️  MEDIUM MEMORY USAGE: ${mem_percent}%${NC}"
    fi
    
    if [ "$total_rss" -gt 2048 ]; then  # 2GB
        warning_level=$((warning_level + 1))
        echo -e "${YELLOW}⚠️  High cluster memory usage: ${total_rss}MB${NC}"
    fi
    
    if [ "$process_count" -eq 0 ]; then
        echo -e "${RED}❌ No Deno processes found - cluster may be down${NC}"
        return 3
    fi
    
    return $warning_level
}

# 建议优化措施
suggest_optimizations() {
    local warning_level="$1"
    local total_rss="$2"
    local process_count="$3"
    
    if [ "$warning_level" -ge 2 ]; then
        echo ""
        echo -e "${PURPLE}💡 Memory Optimization Suggestions:${NC}"
        echo -e "   • Restart cluster: bash scripts/stop-full-cluster.sh && bash scripts/start-full-cluster.sh"
        echo -e "   • Reduce batch size in SolanaBlockDataHandler (current: 10)"
        echo -e "   • Check for memory leaks in logs: grep -i 'memory\|leak' logs/*.log"
        echo -e "   • Monitor ClickHouse connections: netstat -an | grep 9000"
        echo -e "   • Force garbage collection: kill -USR1 <PID> (if supported)"
    fi
    
    if [ "$total_rss" -gt 1024 ] && [ "$process_count" -gt 0 ]; then
        local avg_per_process=$((total_rss / process_count))
        if [ "$avg_per_process" -gt 100 ]; then
            echo -e "   • High per-process memory (${avg_per_process}MB avg), consider reducing worker count"
        fi
    fi
}

# 记录到日志文件
log_metrics() {
    local timestamp="$1"
    local system_info="$2"
    local deno_info="$3"
    
    echo "$timestamp,$system_info,$deno_info" >> "$LOG_FILE"
}

# 主监控循环
monitor_loop() {
    local iteration=0
    
    echo -e "${GREEN}📊 Starting continuous monitoring (Ctrl+C to stop)${NC}"
    echo ""
    
    while true; do
        iteration=$((iteration + 1))
        timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        
        echo -e "${BLUE}=== Monitor Report #$iteration - $timestamp ===${NC}"
        
        # 获取系统内存信息
        system_info=$(get_system_info)
        IFS=',' read -r total_mem used_mem free_mem mem_percent <<< "$system_info"
        
        echo -e "${YELLOW}System Memory:${NC}"
        echo -e "   Total: ${total_mem}MB | Used: ${used_mem}MB (${mem_percent}%) | Free: ${free_mem}MB"
        
        # 获取Deno进程信息
        deno_processes=$(get_deno_processes)
        
        echo -e "${YELLOW}Deno Processes:${NC}"
        if [ -n "$deno_processes" ]; then
            deno_info=$(analyze_memory "$deno_processes")
            IFS=',' read -r total_rss total_vsz process_count <<< "$deno_info"
            
            echo -e "   Count: $process_count | Total RSS: ${total_rss}MB | Total VSZ: ${total_vsz}MB"
            echo "$deno_processes" | while IFS= read -r line; do
                if [ -n "$line" ]; then
                    local rss=$(echo "$line" | awk '{print $6}')
                    local pid=$(echo "$line" | awk '{print $2}')
                    local port=$(echo "$line" | grep -o 'server\.ts [0-9]*' | awk '{print $2}')
                    if [ -z "$port" ]; then
                        port=$(echo "$line" | grep -o 'load-balancer\.ts [0-9]*' | awk '{print $2}')
                        [ -n "$port" ] && port="LB:$port" || port="LB:7999"
                    fi
                    
                    rss_mb=$((rss / 1024))
                    echo -e "     PID $pid (Port $port): ${rss_mb}MB"
                fi
            done
        else
            echo -e "   ${RED}No Deno processes found${NC}"
            deno_info="0,0,0"
            total_rss=0
            process_count=0
        fi
        
        # 检查警告
        check_memory_warning "$mem_percent" "$total_rss" "$process_count"
        warning_level=$?
        
        # 提供优化建议
        suggest_optimizations "$warning_level" "$total_rss" "$process_count"
        
        # 记录到日志
        log_metrics "$timestamp" "$system_info" "$deno_info"
        
        echo ""
        echo -e "${GREEN}Next check in ${MONITOR_INTERVAL} seconds...${NC}"
        echo ""
        
        sleep "$MONITOR_INTERVAL"
    done
}

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}📋 Monitor stopped. Log saved to: $LOG_FILE${NC}"
    echo -e "${BLUE}💡 To analyze logs: tail -f $LOG_FILE${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 检查依赖
if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}⚠️  Warning: 'bc' not found. Some calculations may not work properly.${NC}"
    echo -e "${YELLOW}   Install with: sudo apt-get install bc${NC}"
fi

# 开始监控
monitor_loop 