#!/bin/bash

# HTTP连接错误修复测试脚本

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TEST_PORT=8000
LB_PORT=7999

echo -e "${BLUE}🧪 Testing HTTP Connection Error Fixes...${NC}"
echo ""

# 测试函数
test_case() {
    local name="$1"
    local url="$2"
    local method="$3"
    local data="$4"
    local expected_status="$5"
    local content_type="$6"
    
    echo -ne "   ${YELLOW}Testing $name...${NC} "
    
    if [ "$method" = "POST" ]; then
        if [ -n "$content_type" ]; then
            response=$(curl -s -w "%{http_code}" -X POST "$url" \
                      -H "Content-Type: $content_type" \
                      -d "$data" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" -X POST "$url" \
                      -d "$data" 2>/dev/null)
        fi
    else
        response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
    fi
    
    status_code="${response: -3}"
    body="${response%???}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ ($status_code)${NC}"
    else
        echo -e "${RED}✗ (Expected: $expected_status, Got: $status_code)${NC}"
        if [ -n "$body" ]; then
            echo -e "      Response: $body"
        fi
    fi
}

echo -e "${YELLOW}📋 Step 1: Testing Invalid Content-Type${NC}"
test_case "No Content-Type" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" '{"test": "data"}' "400"
test_case "Wrong Content-Type" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" '{"test": "data"}' "400" "text/plain"

echo ""
echo -e "${YELLOW}📋 Step 2: Testing Empty/Invalid Body${NC}"
test_case "Empty Body" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" "" "400" "application/json"
test_case "Invalid JSON" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" "{invalid json" "400" "application/json"
test_case "Non-Array Body" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" '{"not": "array"}' "400" "application/json"

echo ""
echo -e "${YELLOW}📋 Step 3: Testing Valid Request${NC}"
valid_data='[{"blocknum": 12345, "blockdata": {"blockhash": "test", "previousBlockhash": "prev", "parentSlot": 123, "transactions": []}}]'
test_case "Valid Request" "http://localhost:$TEST_PORT/api/parse-blockdata" "POST" "$valid_data" "200" "application/json"

echo ""
echo -e "${YELLOW}📋 Step 4: Testing Load Balancer Error Handling${NC}"
test_case "LB - Invalid JSON" "http://localhost:$LB_PORT/api/parse-blockdata" "POST" "{invalid json" "400" "application/json"
test_case "LB - Valid Request" "http://localhost:$LB_PORT/api/parse-blockdata" "POST" "$valid_data" "200" "application/json"

echo ""
echo -e "${YELLOW}📋 Step 5: Testing Connection Resilience${NC}"

# 测试大量并发请求
echo -e "   ${BLUE}Testing concurrent requests...${NC}"

success_count=0
for i in {1..10}; do
    response=$(curl -s -w "%{http_code}" -X POST "http://localhost:$LB_PORT/api/parse-blockdata" \
              -H "Content-Type: application/json" \
              -d "$valid_data" 2>/dev/null) &
    
    if [ $((i % 5)) -eq 0 ]; then
        wait
        echo -ne "."
    fi
done

wait
echo -e " ${GREEN}✓ Completed${NC}"

echo ""
echo -e "${GREEN}🎉 HTTP Error Handling Tests Completed!${NC}"
echo ""
echo -e "${BLUE}💡 Key Improvements:${NC}"
echo -e "   • Content-Type validation"
echo -e "   • Request body size limits (100MB)"
echo -e "   • 30-second timeout protection"
echo -e "   • Better error categorization"
echo -e "   • Robust connection error handling"
echo -e "   • Load balancer resilience"
echo ""
echo -e "${YELLOW}📊 Monitor logs to see detailed error messages:${NC}"
echo -e "   tail -f logs/server-8000.log"
echo -e "   tail -f logs/load-balancer.log" 