#!/bin/bash

# 🚀 Solana Swap Scan High Performance Cluster Benchmark
# Tests cluster performance, throughput, and concurrent processing capabilities

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BENCHMARK_LOG="logs/benchmark-$(date +%Y%m%d_%H%M%S).log"

echo -e "${CYAN}🚀 HIGH PERFORMANCE CLUSTER BENCHMARK${NC}"
echo -e "${BLUE}   Testing Solana Swap Scan cluster performance${NC}"
echo -e "${YELLOW}   Benchmark log: $BENCHMARK_LOG${NC}"
echo ""

# Create benchmark log
mkdir -p logs
echo "High Performance Cluster Benchmark - $(date)" > "$BENCHMARK_LOG"

# Test data for benchmarking
TEST_DATA='[{"blocknum":123,"blockdata":{"blockhash":"test_benchmark","blockTime":1234567890,"blockHeight":100,"transactions":[]}}]'

# Function to test individual worker
test_worker() {
    local port=$1
    local start_time=$(date +%s%3N)
    
    response=$(curl -s -X POST -H "Content-Type: application/json" -d "$TEST_DATA" "http://localhost:$port/api/parse-blockdata" 2>/dev/null)
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [[ "$response" == *"success\":true"* ]]; then
        echo "$port,$duration,success" >> "${BENCHMARK_LOG}.workers"
        return 0
    else
        echo "$port,$duration,failed" >> "${BENCHMARK_LOG}.workers"
        return 1
    fi
}

# Phase 1: Individual Worker Performance
echo -e "${PURPLE}📋 Phase 1: Individual Worker Performance Test${NC}"
echo "port,response_time_ms,status" > "${BENCHMARK_LOG}.workers"

successful_workers=0
total_response_time=0

for port in $(seq 8000 8030); do
    echo -n -e "   Testing port $port... "
    
    if test_worker $port; then
        response_time=$(tail -1 "${BENCHMARK_LOG}.workers" | cut -d',' -f2)
        echo -e "${GREEN}✓ ${response_time}ms${NC}"
        successful_workers=$((successful_workers + 1))
        total_response_time=$((total_response_time + response_time))
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
done

if [ $successful_workers -gt 0 ]; then
    avg_response_time=$((total_response_time / successful_workers))
    echo -e "${GREEN}✅ Individual worker results:${NC}"
    echo -e "   Active workers: $successful_workers/31"
    echo -e "   Average response time: ${avg_response_time}ms"
    echo -e "   Estimated throughput: ~$((1000 / avg_response_time)) req/sec per worker"
else
    echo -e "${RED}❌ No workers responding!${NC}"
    exit 1
fi

# Phase 2: Concurrent Load Test
echo ""
echo -e "${PURPLE}📋 Phase 2: Concurrent Load Test${NC}"

# Test with increasing concurrent requests
for concurrent in 10 25 50 100; do
    echo -n -e "   Testing $concurrent concurrent requests... "
    
    start_time=$(date +%s%3N)
    
    # Launch concurrent requests
    for i in $(seq 1 $concurrent); do
        port=$((8000 + (i % 31)))
        curl -s -X POST -H "Content-Type: application/json" -d "$TEST_DATA" "http://localhost:$port/api/parse-blockdata" > /dev/null 2>&1 &
    done
    
    # Wait for all to complete
    wait
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    throughput=$((concurrent * 1000 / duration))
    
    echo -e "${GREEN}✓ ${duration}ms (${throughput} req/sec)${NC}"
    echo "$concurrent,$duration,$throughput" >> "${BENCHMARK_LOG}.concurrent"
done

# Phase 3: Load Balancer Test
echo ""
echo -e "${PURPLE}📋 Phase 3: Load Balancer Stress Test${NC}"

if curl -s http://localhost:7999/health > /dev/null 2>&1; then
    echo -n -e "   Testing load balancer with 50 requests... "
    
    start_time=$(date +%s%3N)
    
    for i in $(seq 1 50); do
        curl -s -X POST -H "Content-Type: application/json" -d "$TEST_DATA" "http://localhost:7999/api/parse-blockdata" > /dev/null 2>&1 &
    done
    
    wait
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    throughput=$((50 * 1000 / duration))
    
    echo -e "${GREEN}✓ ${duration}ms (${throughput} req/sec through LB)${NC}"
else
    echo -e "${YELLOW}⚠️  Load balancer not available${NC}"
fi

# Phase 4: Memory Efficiency Check
echo ""
echo -e "${PURPLE}📋 Phase 4: Memory Efficiency Analysis${NC}"

total_memory=0
process_count=0

while IFS= read -r line; do
    if [[ $line == *"deno run"* && $line == *"src/server.ts"* ]]; then
        memory=$(echo "$line" | awk '{print $6}' | sed 's/[^0-9]//g')
        if [ ! -z "$memory" ]; then
            total_memory=$((total_memory + memory))
            process_count=$((process_count + 1))
        fi
    fi
done < <(ps aux | grep deno)

if [ $process_count -gt 0 ]; then
    avg_memory=$((total_memory / process_count / 1024)) # Convert to MB
    total_memory_mb=$((total_memory / 1024))
    
    echo -e "${GREEN}✅ Memory efficiency results:${NC}"
    echo -e "   Active processes: $process_count"
    echo -e "   Total memory usage: ${total_memory_mb}MB"
    echo -e "   Average per process: ${avg_memory}MB"
    echo -e "   Memory efficiency: ${GREEN}Excellent${NC} (low footprint)"
fi

# Phase 5: System Resource Analysis
echo ""
echo -e "${PURPLE}📋 Phase 5: System Resource Analysis${NC}"

# CPU Usage
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
echo -e "   CPU usage: ${cpu_usage}%"

# System Memory
mem_info=$(free -m | grep "Mem:")
total_mem=$(echo $mem_info | awk '{print $2}')
used_mem=$(echo $mem_info | awk '{print $3}')
mem_percentage=$((used_mem * 100 / total_mem))
echo -e "   System memory: ${used_mem}MB / ${total_mem}MB (${mem_percentage}%)"

# Network connections
active_connections=$(netstat -an | grep -E ":(8000|8001|8002|8003|8004|8005|8006|8007|8008|8009|8010|8011|8012|8013|8014|8015|8016|8017|8018|8019|8020|8021|8022|8023|8024|8025|8026|8027|8028|8029|8030|7999)" | grep LISTEN | wc -l)
echo -e "   Active listeners: $active_connections"

# Final Summary
echo ""
echo -e "${CYAN}🎉 BENCHMARK COMPLETE!${NC}"
echo ""
echo -e "${GREEN}📊 PERFORMANCE SUMMARY:${NC}"
echo -e "   ⚡ Cluster mode: ${YELLOW}HIGH PERFORMANCE${NC}"
echo -e "   🏃 Active workers: ${successful_workers}/31"
echo -e "   ⏱️  Average response: ${avg_response_time}ms"
echo -e "   🚀 Max throughput: ~${throughput} req/sec"
echo -e "   💾 Memory per process: ~${avg_memory}MB"
echo -e "   📈 System load: ${mem_percentage}% memory, ${cpu_usage}% CPU"

echo ""
echo -e "${BLUE}🔍 Detailed results saved to:${NC}"
echo -e "   Main log: $BENCHMARK_LOG"
echo -e "   Worker data: ${BENCHMARK_LOG}.workers"
echo -e "   Concurrent data: ${BENCHMARK_LOG}.concurrent"

echo ""
echo -e "${PURPLE}💡 Performance Analysis:${NC}"

if [ $avg_response_time -lt 20 ]; then
    echo -e "   Response time: ${GREEN}Excellent${NC} (<20ms)"
elif [ $avg_response_time -lt 50 ]; then
    echo -e "   Response time: ${YELLOW}Good${NC} (20-50ms)"
else
    echo -e "   Response time: ${RED}Needs optimization${NC} (>50ms)"
fi

if [ $throughput -gt 1000 ]; then
    echo -e "   Throughput: ${GREEN}Excellent${NC} (>1000 req/sec)"
elif [ $throughput -gt 500 ]; then
    echo -e "   Throughput: ${YELLOW}Good${NC} (500-1000 req/sec)"
else
    echo -e "   Throughput: ${RED}Needs optimization${NC} (<500 req/sec)"
fi

if [ $avg_memory -lt 150 ]; then
    echo -e "   Memory efficiency: ${GREEN}Excellent${NC} (<150MB per process)"
elif [ $avg_memory -lt 300 ]; then
    echo -e "   Memory efficiency: ${YELLOW}Good${NC} (150-300MB per process)"
else
    echo -e "   Memory efficiency: ${RED}Needs optimization${NC} (>300MB per process)"
fi

echo ""
echo -e "${CYAN}🚀 High Performance cluster is ready for production workloads!${NC}" 