#!/bin/bash

# 性能对比脚本
# 帮助用户选择最适合的启动模式

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取系统信息
get_system_info() {
    local total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    local cpu_cores=$(nproc)
    local cpu_freq=$(lscpu | grep "CPU MHz" | awk '{print $3}' | head -1)
    
    echo "$total_memory,$cpu_cores,$cpu_freq"
}

# 分析性能模式
analyze_performance_modes() {
    local total_memory="$1"
    local cpu_cores="$2"
    local cpu_freq="$3"
    
    echo -e "${CYAN}📊 Performance Mode Analysis${NC}"
    echo ""
    
    # 高性能模式评估
    local hp_memory_required=$((31 * 2200))  # 31个进程 * 2.2GB
    local hp_suitable=true
    
    if [ "$total_memory" -lt "$hp_memory_required" ]; then
        hp_suitable=false
    fi
    
    echo -e "${PURPLE}⚡ HIGH PERFORMANCE MODE${NC}"
    echo -e "   Memory required: ${hp_memory_required}MB"
    echo -e "   Memory available: ${total_memory}MB"
    if [ "$hp_suitable" = true ]; then
        echo -e "   Status: ${GREEN}✅ RECOMMENDED for your system${NC}"
        echo -e "   Performance: ${GREEN}🔥 MAXIMUM SPEED${NC}"
        echo -e "   Throughput: ${GREEN}~3-5x faster than memory-optimized${NC}"
    else
        echo -e "   Status: ${RED}❌ Not recommended (insufficient memory)${NC}"
        echo -e "   Risk: ${RED}System may become unstable${NC}"
    fi
    
    echo ""
    
    # 内存优化模式评估
    local mo_memory_required=$((31 * 600))   # 31个进程 * 600MB
    local mo_suitable=true
    
    if [ "$total_memory" -lt "$mo_memory_required" ]; then
        mo_suitable=false
    fi
    
    echo -e "${BLUE}🧠 MEMORY OPTIMIZED MODE${NC}"
    echo -e "   Memory required: ${mo_memory_required}MB"
    echo -e "   Memory available: ${total_memory}MB"
    if [ "$mo_suitable" = true ]; then
        echo -e "   Status: ${GREEN}✅ SAFE for your system${NC}"
        echo -e "   Performance: ${YELLOW}⚖️  BALANCED${NC}"
        echo -e "   Stability: ${GREEN}🛡️  HIGH STABILITY${NC}"
    else
        echo -e "   Status: ${RED}❌ May still be risky${NC}"
        echo -e "   Suggestion: ${YELLOW}Reduce process count${NC}"
    fi
    
    echo ""
    
    # 标准模式评估
    echo -e "${GREEN}🔄 STANDARD MODE (Default)${NC}"
    echo -e "   Memory required: ~${mo_memory_required}MB"
    echo -e "   Status: ${GREEN}✅ Balanced approach${NC}"
    echo -e "   Performance: ${YELLOW}⚖️  Good performance with safety${NC}"
    echo -e "   Use case: ${YELLOW}Production environments${NC}"
    
    echo ""
}

# 推荐模式
recommend_mode() {
    local total_memory="$1"
    local cpu_cores="$2"
    
    echo -e "${CYAN}🎯 RECOMMENDATION${NC}"
    echo ""
    
    local hp_memory_required=$((31 * 2200))
    local mo_memory_required=$((31 * 600))
    
    if [ "$total_memory" -gt "$hp_memory_required" ]; then
        if [ "$cpu_cores" -ge 8 ]; then
            echo -e "${PURPLE}🏆 RECOMMENDED: HIGH PERFORMANCE MODE${NC}"
            echo -e "   Command: ${GREEN}bash scripts/high-performance-start.sh${NC}"
            echo -e "   Reason: You have sufficient memory (${total_memory}MB) and CPU cores (${cpu_cores})"
            echo -e "   Benefits: Maximum speed, ~3-5x faster processing"
            echo -e "   Trade-off: Higher memory usage, monitor system closely"
        else
            echo -e "${GREEN}🏆 RECOMMENDED: STANDARD MODE${NC}"
            echo -e "   Command: ${GREEN}bash scripts/start-full-cluster.sh${NC}"
            echo -e "   Reason: Good memory but limited CPU cores (${cpu_cores})"
            echo -e "   Benefits: Balanced performance and stability"
        fi
    elif [ "$total_memory" -gt "$mo_memory_required" ]; then
        echo -e "${BLUE}🏆 RECOMMENDED: MEMORY OPTIMIZED MODE${NC}"
        echo -e "   Command: ${GREEN}bash scripts/memory-optimized-start.sh${NC}"
        echo -e "   Reason: Limited memory (${total_memory}MB), need careful management"
        echo -e "   Benefits: Stable operation with memory safeguards"
        echo -e "   Trade-off: Slower processing but guaranteed stability"
    else
        echo -e "${YELLOW}🏆 RECOMMENDED: REDUCE PROCESS COUNT${NC}"
        echo -e "   Suggestion: Edit scripts to use ports 8000-8015 (16 processes)"
        echo -e "   Reason: Very limited memory (${total_memory}MB)"
        echo -e "   Alternative: Use memory-optimized with fewer processes"
    fi
}

# 性能对比表
show_performance_comparison() {
    echo ""
    echo -e "${CYAN}📈 Performance Comparison Table${NC}"
    echo ""
    echo -e "${YELLOW}┌─────────────────────┬─────────────────┬─────────────────┬─────────────────┐${NC}"
    echo -e "${YELLOW}│ Feature             │ High Performance│ Standard        │ Memory Optimized│${NC}"
    echo -e "${YELLOW}├─────────────────────┼─────────────────┼─────────────────┼─────────────────┤${NC}"
    echo -e "${YELLOW}│ Memory per process  │${NC} 2GB             ${YELLOW}│${NC} 512MB (auto)    ${YELLOW}│${NC} 512MB (limited) ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Concurrent requests │${NC} Unlimited       ${YELLOW}│${NC} Smart batching  ${YELLOW}│${NC} 10 at a time    ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Processing speed    │${NC} ${GREEN}🔥 Fastest${NC}      ${YELLOW}│${NC} ${GREEN}⚡ Fast${NC}        ${YELLOW}│${NC} ${BLUE}🐢 Steady${NC}      ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Memory safety       │${NC} ${RED}⚠️  Monitor${NC}     ${YELLOW}│${NC} ${GREEN}✅ Safe${NC}        ${YELLOW}│${NC} ${GREEN}🛡️  Very Safe${NC} ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Error recovery      │${NC} Basic           ${YELLOW}│${NC} Good            ${YELLOW}│${NC} Excellent       ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Resource usage      │${NC} ${RED}High${NC}           ${YELLOW}│${NC} ${YELLOW}Medium${NC}         ${YELLOW}│${NC} ${GREEN}Low${NC}            ${YELLOW}│${NC}"
    echo -e "${YELLOW}│ Use case            │${NC} Speed critical  ${YELLOW}│${NC} Production      ${YELLOW}│${NC} Limited resources${YELLOW}│${NC}"
    echo -e "${YELLOW}└─────────────────────┴─────────────────┴─────────────────┴─────────────────┘${NC}"
}

# 主函数
main() {
    echo -e "${PURPLE}🚀 Solana Swap Scan Performance Mode Selector${NC}"
    echo ""
    
    # 获取系统信息
    system_info=$(get_system_info)
    IFS=',' read -r total_memory cpu_cores cpu_freq <<< "$system_info"
    
    echo -e "${BLUE}💻 System Information:${NC}"
    echo -e "   Total Memory: ${total_memory}MB"
    echo -e "   CPU Cores: ${cpu_cores}"
    echo -e "   CPU Frequency: ${cpu_freq:-Unknown} MHz"
    echo ""
    
    # 分析性能模式
    analyze_performance_modes "$total_memory" "$cpu_cores" "$cpu_freq"
    
    # 显示对比表
    show_performance_comparison
    
    # 推荐模式
    recommend_mode "$total_memory" "$cpu_cores"
    
    echo ""
    echo -e "${YELLOW}🎛️  Quick Start Commands:${NC}"
    echo ""
    echo -e "${PURPLE}   HIGH PERFORMANCE (Speed First):${NC}"
    echo -e "   ${GREEN}bash scripts/high-performance-start.sh${NC}"
    echo ""
    echo -e "${BLUE}   MEMORY OPTIMIZED (Safety First):${NC}"
    echo -e "   ${GREEN}bash scripts/memory-optimized-start.sh${NC}"
    echo ""
    echo -e "${GREEN}   STANDARD (Balanced):${NC}"
    echo -e "   ${GREEN}bash scripts/start-full-cluster.sh${NC}"
    echo ""
    echo -e "${CYAN}   COMPARE MODES:${NC}"
    echo -e "   ${GREEN}bash scripts/performance-comparison.sh${NC}"
    echo ""
    
    # 交互式选择
    echo -e "${YELLOW}🚀 Start a cluster now?${NC}"
    echo "1) High Performance Mode (Speed First)"
    echo "2) Memory Optimized Mode (Safety First)" 
    echo "3) Standard Mode (Balanced)"
    echo "4) Exit"
    echo ""
    read -p "Choose an option (1-4): " choice
    
    case $choice in
        1)
            echo -e "${PURPLE}🔥 Starting High Performance Mode...${NC}"
            bash scripts/high-performance-start.sh
            ;;
        2)
            echo -e "${BLUE}🧠 Starting Memory Optimized Mode...${NC}"
            bash scripts/memory-optimized-start.sh
            ;;
        3)
            echo -e "${GREEN}⚖️  Starting Standard Mode...${NC}"
            bash scripts/start-full-cluster.sh
            ;;
        4)
            echo -e "${YELLOW}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
}

# 运行主函数
main 