#!/bin/bash

# Solana Swap Scan - Smart Start Script
# 智能选择最优启动模式

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 Solana Swap Scan Smart Launcher${NC}"
echo ""

# 快速系统检测
total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
hp_memory_required=$((31 * 2200))

echo -e "${BLUE}💡 Quick Mode Selection:${NC}"
echo ""

if [ "$total_memory" -gt "$hp_memory_required" ]; then
    echo -e "${GREEN}1) 🔥 HIGH PERFORMANCE (Recommended for your system)${NC}"
    echo -e "   Speed: Maximum | Memory: ${total_memory}MB available"
    echo ""
    echo -e "${YELLOW}2) ⚖️  STANDARD MODE (Balanced)${NC}"
    echo -e "   Speed: Fast | Memory: Safe"
    echo ""
    echo -e "${BLUE}3) 🧠 MEMORY OPTIMIZED (Conservative)${NC}"
    echo -e "   Speed: Steady | Memory: Very Safe"
    echo ""
    echo -e "${CYAN}4) 📊 DETAILED COMPARISON${NC}"
    echo -e "   Analyze and compare all modes"
    
    default_choice=1
    echo ""
    echo -e "${GREEN}💡 Your system has sufficient memory for HIGH PERFORMANCE mode${NC}"
else
    echo -e "${BLUE}1) 🧠 MEMORY OPTIMIZED (Recommended for your system)${NC}"
    echo -e "   Speed: Steady | Memory: Very Safe"
    echo ""
    echo -e "${YELLOW}2) ⚖️  STANDARD MODE (Balanced)${NC}"
    echo -e "   Speed: Fast | Memory: Safe"
    echo ""
    echo -e "${RED}3) 🔥 HIGH PERFORMANCE (Risk: May exceed memory)${NC}"
    echo -e "   Speed: Maximum | Memory: ${total_memory}MB (need ${hp_memory_required}MB)"
    echo ""
    echo -e "${CYAN}4) 📊 DETAILED COMPARISON${NC}"
    echo -e "   Analyze and compare all modes"
    
    default_choice=1
    echo ""
    echo -e "${YELLOW}💡 Your system has limited memory, MEMORY OPTIMIZED recommended${NC}"
fi

echo ""
read -p "Choose mode (1-4, default=$default_choice): " choice
choice=${choice:-$default_choice}

case $choice in
    1)
        if [ "$total_memory" -gt "$hp_memory_required" ]; then
            echo -e "${PURPLE}🔥 Starting HIGH PERFORMANCE mode...${NC}"
            bash scripts/high-performance-start.sh
        else
            echo -e "${BLUE}🧠 Starting MEMORY OPTIMIZED mode...${NC}"
            bash scripts/memory-optimized-start.sh
        fi
        ;;
    2)
        echo -e "${GREEN}⚖️  Starting STANDARD mode...${NC}"
        bash scripts/start-full-cluster.sh
        ;;
    3)
        if [ "$total_memory" -gt "$hp_memory_required" ]; then
            echo -e "${BLUE}🧠 Starting MEMORY OPTIMIZED mode...${NC}"
            bash scripts/memory-optimized-start.sh
        else
            echo -e "${RED}⚠️  Starting HIGH PERFORMANCE mode (RISKY)...${NC}"
            echo -e "${YELLOW}Monitor system resources closely!${NC}"
            bash scripts/high-performance-start.sh
        fi
        ;;
    4)
        echo -e "${CYAN}📊 Opening detailed comparison...${NC}"
        bash scripts/performance-comparison.sh
        ;;
    *)
        echo -e "${RED}❌ Invalid choice, starting standard mode...${NC}"
        bash scripts/start-full-cluster.sh
        ;;
esac 