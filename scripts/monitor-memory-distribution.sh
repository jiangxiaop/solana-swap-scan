#!/bin/bash

# 内存分布监控脚本
echo "💾 Memory Distribution Analysis"
echo "==============================="
echo ""

# 系统内存总览
echo "🖥️  System Memory Overview:"
free -h | head -2
echo ""

# Deno/Node进程内存详情
echo "📊 Process Memory Details:"
echo "PID     CPU  %MEM   RSS    VSZ    Command"
echo "----------------------------------------"
ps -eo pid,psr,%mem,rss,vsz,comm,cmd | grep -E "(deno|node)" | grep -v grep | sort -k3 -nr | while read pid cpu mem rss vsz comm cmd; do
    printf "%-6s  %-3s  %-5s  %-7s %-7s %s\n" "$pid" "$cpu" "$mem" "$rss" "$vsz" "$comm"
done

echo ""
echo "📈 Memory Usage Statistics:"
echo "==========================="

# 计算总内存使用
total_mem=$(ps -eo %mem,comm | grep -E "(deno|node)" | awk '{sum += $1} END {print sum}')
total_rss=$(ps -eo rss,comm | grep -E "(deno|node)" | awk '{sum += $1} END {print sum}')
process_count=$(ps -eo comm | grep -E "(deno|node)" | wc -l)

echo "Total processes: $process_count"
echo "Total memory usage: ${total_mem}%"
echo "Total RSS memory: $(echo "scale=1; $total_rss / 1024" | bc) MB"
echo "Average memory per process: $(echo "scale=1; $total_mem / $process_count" | bc)%"
echo "Average RSS per process: $(echo "scale=1; $total_rss / $process_count / 1024" | bc) MB"

echo ""
echo "🔍 Memory Distribution by CPU Core:"
echo "==================================="

# 按CPU核心分组显示内存使用
for core in $(seq 0 $(($(nproc)-1))); do
    # 获取该核心上的进程
    core_processes=$(ps -eo psr,pid,comm | grep -E "(deno|node)" | grep "^[[:space:]]*$core[[:space:]]" | wc -l)
    
    if [ $core_processes -gt 0 ]; then
        core_mem=$(ps -eo psr,%mem | grep -E "^[[:space:]]*$core[[:space:]]" | awk '{sum += $2} END {print sum}')
        core_rss=$(ps -eo psr,rss | grep -E "^[[:space:]]*$core[[:space:]]" | awk '{sum += $2} END {print sum/1024}')
        
        printf "CPU Core %2d: %d processes, %.1f%% memory, %.1f MB RSS\n" "$core" "$core_processes" "$core_mem" "$core_rss"
    fi
done

echo ""
echo "⚠️  High Memory Usage Alert:"
echo "============================"

# 找出内存使用最高的进程
echo "Top 5 memory consumers:"
ps -eo pid,psr,%mem,rss,comm,cmd | grep -E "(deno|node)" | grep -v grep | sort -k3 -nr | head -5 | while read pid cpu mem rss comm cmd; do
    if (( $(echo "$mem > 2.0" | bc -l) )); then
        printf "⚠️  PID %-6s CPU %-2s MEM %-5s%% RSS %-7s %s\n" "$pid" "$cpu" "$mem" "$rss" "$comm"
    else
        printf "✅ PID %-6s CPU %-2s MEM %-5s%% RSS %-7s %s\n" "$pid" "$cpu" "$mem" "$rss" "$comm"
    fi
done

echo ""
echo "🔧 Memory Optimization Recommendations:"
echo "======================================="

# 内存优化建议
avg_mem_per_process=$(echo "scale=1; $total_mem / $process_count" | bc)
system_mem_total=$(free | grep Mem | awk '{print $2}')
used_mem_mb=$(echo "scale=0; $total_rss / 1024" | bc)

if (( $(echo "$total_mem > 50" | bc -l) )); then
    echo "⚠️  HIGH MEMORY USAGE: $total_mem% of system memory"
    echo "   Consider reducing worker count or memory limits"
fi

if (( $(echo "$avg_mem_per_process > 3.0" | bc -l) )); then
    echo "⚠️  HIGH PER-PROCESS MEMORY: ${avg_mem_per_process}% average"
    echo "   Consider reducing --max-old-space-size parameter"
fi

# 检查是否有内存不均匀分布
max_core_mem=0
min_core_mem=100
for core in $(seq 0 $(($(nproc)-1))); do
    core_mem=$(ps -eo psr,%mem | grep -E "^[[:space:]]*$core[[:space:]]" | awk '{sum += $2} END {print sum}')
    if [ ! -z "$core_mem" ] && [ "$core_mem" != "" ]; then
        if (( $(echo "$core_mem > $max_core_mem" | bc -l) )); then
            max_core_mem=$core_mem
        fi
        if (( $(echo "$core_mem < $min_core_mem" | bc -l) )); then
            min_core_mem=$core_mem
        fi
    fi
done

mem_variance=$(echo "scale=1; $max_core_mem - $min_core_mem" | bc)
if (( $(echo "$mem_variance > 5.0" | bc -l) )); then
    echo "⚠️  UNEVEN MEMORY DISTRIBUTION: ${mem_variance}% variance between cores"
    echo "   Consider rebalancing process distribution"
fi

echo ""
echo "💡 Suggested Actions:"
echo "===================="
echo "1. If memory usage is high, restart with: bash scripts/multi-core-optimized-start.sh"
echo "2. For memory monitoring: watch -n 5 'bash scripts/monitor-memory-distribution.sh'"
echo "3. Emergency stop if needed: bash scripts/emergency-stop.sh" 