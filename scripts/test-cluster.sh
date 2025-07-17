#!/bin/bash

# Solana Swap Scan Cluster Test Script
# 测试集群的各种功能

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

LOAD_BALANCER_PORT=7999
TEST_PASSED=0
TEST_FAILED=0

echo -e "${BLUE}🧪 Testing Solana Swap Scan Cluster...${NC}"
echo ""

# 辅助函数
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -ne "   ${YELLOW}Testing $name...${NC} "
    
    if [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -w "%{http_code}" -X POST "$url" \
                      -H "Content-Type: application/json" \
                      -d "$data" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" -X POST "$url" 2>/dev/null)
        fi
    else
        response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ]; then
        status_code="${response: -3}"
        body="${response%???}"
        
        if [ "$status_code" = "$expected_status" ]; then
            echo -e "${GREEN}✓ ($status_code)${NC}"
            ((TEST_PASSED++))
            return 0
        else
            echo -e "${RED}✗ (Expected: $expected_status, Got: $status_code)${NC}"
            ((TEST_FAILED++))
            return 1
        fi
    else
        echo -e "${RED}✗ (Connection failed)${NC}"
        ((TEST_FAILED++))
        return 1
    fi
}

# 1. 基础连接测试
echo -e "${YELLOW}📋 Step 1: Basic Connectivity Tests${NC}"

test_endpoint "Load Balancer Health" "http://localhost:$LOAD_BALANCER_PORT/lb-health"
test_endpoint "Load Balancer Status" "http://localhost:$LOAD_BALANCER_PORT/lb-status"

# 测试直接连接工作进程
echo ""
echo -e "${YELLOW}📋 Step 2: Worker Process Tests${NC}"

for port in 8000 8005 8010 8015 8020 8025 8030; do
    test_endpoint "Worker $port Health" "http://localhost:$port/health"
done

# 3. API功能测试
echo ""
echo -e "${YELLOW}📋 Step 3: API Functionality Tests${NC}"

# 创建测试数据
test_data='{
    "blockdata": {
        "blockhash": "test-hash",
        "previousBlockhash": "prev-hash",
        "parentSlot": 123456,
        "transactions": []
    },
    "blocknum": 12345
}'

test_data_array="[$test_data]"

# 通过负载均衡器测试API
test_endpoint "API via Load Balancer" "http://localhost:$LOAD_BALANCER_PORT/api/parse-blockdata" "POST" "$test_data_array"

# 直接测试几个工作进程的API
test_endpoint "API via Worker 8000" "http://localhost:8000/api/parse-blockdata" "POST" "$test_data_array"
test_endpoint "API via Worker 8015" "http://localhost:8015/api/parse-blockdata" "POST" "$test_data_array"

# 4. 负载分布测试
echo ""
echo -e "${YELLOW}📋 Step 4: Load Distribution Test${NC}"

echo -e "   ${BLUE}Sending 10 requests through load balancer...${NC}"

for i in {1..10}; do
    response=$(curl -s -X POST "http://localhost:$LOAD_BALANCER_PORT/api/parse-blockdata" \
              -H "Content-Type: application/json" \
              -d "$test_data_array" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # 提取服务器端口号（如果响应包含该信息）
        port=$(echo "$response" | grep -o '"port":[0-9]*' | cut -d':' -f2)
        if [ -n "$port" ]; then
            echo -e "     Request $i → Port $port"
        else
            echo -e "     Request $i → ${GREEN}✓${NC}"
        fi
    else
        echo -e "     Request $i → ${RED}✗${NC}"
    fi
    
    sleep 0.1
done

# 5. 性能测试
echo ""
echo -e "${YELLOW}📋 Step 5: Basic Performance Test${NC}"

echo -e "   ${BLUE}Testing concurrent requests...${NC}"

# 创建临时脚本进行并发测试
cat > /tmp/test_request.sh << 'EOF'
#!/bin/bash
curl -s -X POST "http://localhost:7999/api/parse-blockdata" \
     -H "Content-Type: application/json" \
     -d '[{"blockdata":{"blockhash":"test","previousBlockhash":"prev","parentSlot":123,"transactions":[]},"blocknum":12345}]' \
     > /dev/null 2>&1
echo $?
EOF

chmod +x /tmp/test_request.sh

# 启动5个并发请求
concurrent_results=()
for i in {1..5}; do
    /tmp/test_request.sh &
    pids[${i}]=$!
done

# 等待所有请求完成
success_count=0
for i in {1..5}; do
    wait ${pids[$i]}
    if [ $? -eq 0 ]; then
        ((success_count++))
    fi
done

echo -e "   ${GREEN}✓${NC} Concurrent requests: $success_count/5 successful"

# 清理临时文件
rm -f /tmp/test_request.sh

# 6. 集群状态检查
echo ""
echo -e "${YELLOW}📋 Step 6: Cluster Status Analysis${NC}"

status_response=$(curl -s "http://localhost:$LOAD_BALANCER_PORT/lb-status" 2>/dev/null)

if [ $? -eq 0 ]; then
    total_servers=$(echo "$status_response" | grep -o '"totalServers":[0-9]*' | cut -d':' -f2)
    healthy_servers=$(echo "$status_response" | grep -o '"healthyServers":[0-9]*' | cut -d':' -f2)
    
    echo -e "   ${BLUE}Total servers: $total_servers${NC}"
    echo -e "   ${GREEN}Healthy servers: $healthy_servers${NC}"
    
    if [ "$healthy_servers" -eq "$total_servers" ]; then
        echo -e "   ${GREEN}✓ All servers are healthy${NC}"
        ((TEST_PASSED++))
    elif [ "$healthy_servers" -gt 0 ]; then
        echo -e "   ${YELLOW}⚠ Some servers are unhealthy ($healthy_servers/$total_servers)${NC}"
        ((TEST_FAILED++))
    else
        echo -e "   ${RED}✗ No healthy servers${NC}"
        ((TEST_FAILED++))
    fi
else
    echo -e "   ${RED}✗ Could not get cluster status${NC}"
    ((TEST_FAILED++))
fi

# 7. 结果汇总
echo ""
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo -e "${GREEN}   Passed: $TEST_PASSED${NC}"
echo -e "${RED}   Failed: $TEST_FAILED${NC}"

if [ $TEST_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Your cluster is working perfectly!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the cluster status.${NC}"
    echo ""
    echo -e "${BLUE}💡 Troubleshooting tips:${NC}"
    echo -e "   • Check if all processes are running: ps aux | grep deno"
    echo -e "   • View logs: tail -f logs/*.log"
    echo -e "   • Test individual processes: curl http://localhost:8000/health"
    echo -e "   • Restart cluster: bash scripts/stop-full-cluster.sh && bash scripts/start-full-cluster.sh"
    exit 1
fi 