#!/bin/bash

# CPU核心分布检查脚本
echo "🖥️  CPU Core Distribution Analysis"
echo "=================================="
echo ""

# 检查Deno进程的CPU分布
echo "📊 Deno Processes CPU Distribution:"
echo "PID     CPU  MEM%    RSS    Command"
echo "------------------------------------"
ps -eo pid,psr,%mem,rss,comm,cmd | grep -E "(deno|node)" | grep -v grep | while read pid cpu mem rss comm cmd; do
    printf "%-6s  %-3s  %-6s  %-8s %s\n" "$pid" "$cpu" "$mem" "$rss" "$comm"
done

echo ""
echo "🔍 CPU Core Usage Summary:"
echo "=========================="

# 统计每个CPU核心的进程数
for core in $(seq 0 $(($(nproc)-1))); do
    count=$(ps -eo psr,comm | grep -E "(deno|node)" | grep "^[[:space:]]*$core[[:space:]]" | wc -l)
    if [ $count -gt 0 ]; then
        echo "CPU Core $core: $count processes"
    fi
done

echo ""
echo "💾 Memory Usage by Core:"
echo "======================="

# 统计每个CPU核心的内存使用
for core in $(seq 0 $(($(nproc)-1))); do
    mem_total=$(ps -eo psr,%mem | grep -E "^[[:space:]]*$core[[:space:]]" | awk '{sum += $2} END {print sum}')
    if [ ! -z "$mem_total" ] && [ "$mem_total" != "" ]; then
        printf "CPU Core %2d: %.1f%% memory\n" "$core" "$mem_total"
    fi
done

echo ""
echo "⚡ CPU Load Distribution:"
echo "========================"

# 显示CPU负载
if command -v mpstat &> /dev/null; then
    mpstat -P ALL 1 1 | grep -E "CPU|Average"
else
    echo "Install sysstat for detailed CPU analysis: sudo apt-get install sysstat"
fi

echo ""
echo "🔧 Optimization Recommendations:"
echo "================================"

# 分析是否有CPU核心负载不均
total_processes=$(ps -eo psr,comm | grep -E "(deno|node)" | wc -l)
cores_used=$(ps -eo psr,comm | grep -E "(deno|node)" | awk '{print $1}' | sort -u | wc -l)
total_cores=$(nproc)

echo "Total processes: $total_processes"
echo "Cores in use: $cores_used / $total_cores"
echo "Average processes per core: $(echo "scale=1; $total_processes / $cores_used" | bc)"

if [ $cores_used -lt $((total_cores / 2)) ]; then
    echo "⚠️  WARNING: Using less than 50% of available CPU cores"
    echo "   Consider redistributing processes for better performance"
fi

if [ $total_processes -gt $((total_cores * 2)) ]; then
    echo "⚠️  WARNING: More processes than 2x CPU cores"
    echo "   Consider reducing worker count to prevent context switching overhead"
fi 