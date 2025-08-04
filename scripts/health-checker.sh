#!/bin/bash

# 健康检查工具
# 提供独立的健康检查功能和健康度评分

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 默认配置
START_PORT=${START_PORT:-8000}
END_PORT=${END_PORT:-8030}
PID_DIR=${PID_DIR:-"pids"}
LOG_DIR=${LOG_DIR:-"logs"}

# 健康检查阈值
MAX_MEMORY_PERCENT=${MAX_MEMORY_PERCENT:-85}
MAX_CPU_PERCENT=${MAX_CPU_PERCENT:-90}
MAX_RESPONSE_TIME=${MAX_RESPONSE_TIME:-5000}
MIN_HEALTH_SCORE=${MIN_HEALTH_SCORE:-80}

# 显示使用说明
show_usage() {
    printf "${BLUE}健康检查工具使用说明${NC}\n"
    printf "用法: bash scripts/health-checker.sh [选项] [端口]\n\n"
    printf "选项:\n"
    printf "  --all, -a           检查所有端口\n"
    printf "  --port PORT, -p     检查指定端口\n"
    printf "  --quick, -q         快速检查（仅PID和HTTP）\n"
    printf "  --detailed, -d      详细检查（包含历史数据）\n"
    printf "  --score, -s         显示健康度评分\n"
    printf "  --json              以JSON格式输出结果\n"
    printf "  --help, -h          显示此帮助信息\n\n"
    printf "示例:\n"
    printf "  $0 --all            # 检查所有端口\n"
    printf "  $0 --port 8015      # 检查端口8015\n"
    printf "  $0 -a --json        # 以JSON格式检查所有端口\n"
}

# 检查进程基本信息
get_process_info() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        echo "PID文件不存在"
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        echo "PID文件为空"
        return 1
    fi
    
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "进程不存在(PID: $pid)"
        return 1
    fi
    
    # 获取进程详细信息
    local process_info=$(ps -p "$pid" -o pid,ppid,etime,pcpu,pmem,comm,cmd --no-headers 2>/dev/null)
    if [[ -z "$process_info" ]]; then
        echo "无法获取进程信息"
        return 1
    fi
    
    echo "$process_info"
    return 0
}

# CPU使用率检查
check_cpu_usage() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        return 1
    fi
    
    # 获取CPU使用率（需要两次采样计算平均值）
    local cpu1=$(ps -p "$pid" -o pcpu= 2>/dev/null | tr -d ' ')
    sleep 1
    local cpu2=$(ps -p "$pid" -o pcpu= 2>/dev/null | tr -d ' ')
    
    if [[ -z "$cpu1" || -z "$cpu2" ]]; then
        return 1
    fi
    
    # 计算平均CPU使用率
    local cpu_avg=$(echo "($cpu1 + $cpu2) / 2" | bc -l 2>/dev/null)
    if [[ -z "$cpu_avg" ]]; then
        cpu_avg="$cpu1"
    fi
    
    echo "$cpu_avg"
    
    # 检查是否超过阈值
    if (( $(echo "$cpu_avg > $MAX_CPU_PERCENT" | bc -l) )); then
        return 2  # CPU使用率过高
    fi
    
    return 0
}

# 内存使用详细检查
check_memory_detailed() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        return 1
    fi
    
    # 获取详细内存信息
    local memory_info=$(ps -p "$pid" -o pid,rss,vsz,pmem --no-headers 2>/dev/null)
    if [[ -z "$memory_info" ]]; then
        return 1
    fi
    
    local rss=$(echo "$memory_info" | awk '{print $2}')
    local vsz=$(echo "$memory_info" | awk '{print $3}')
    local pmem=$(echo "$memory_info" | awk '{print $4}')
    
    local rss_mb=$((rss / 1024))
    local vsz_mb=$((vsz / 1024))
    
    # 获取系统总内存
    local total_memory=$(free -m | awk 'NR==2{print $2}')
    local memory_percent=$((rss_mb * 100 / total_memory))
    
    # 输出内存信息
    printf "RSS: ${rss_mb}MB, VSZ: ${vsz_mb}MB, 系统占比: ${memory_percent}%%"
    
    if [[ $memory_percent -gt $MAX_MEMORY_PERCENT ]]; then
        return 2  # 内存使用过高
    fi
    
    return 0
}

# HTTP响应时间检查
check_response_time() {
    local port="$1"
    local endpoint="${2:-/health}"
    
    local start_time=$(date +%s%3N)
    local response=$(curl -s -m 10 "http://localhost:$port$endpoint" 2>/dev/null)
    local curl_exit_code=$?
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [[ $curl_exit_code -eq 0 ]]; then
        echo "响应时间: ${response_time}ms"
        
        # 检查响应内容
        if echo "$response" | grep -q '"status":"healthy"'; then
            if [[ $response_time -le $MAX_RESPONSE_TIME ]]; then
                return 0  # 正常
            else
                return 2  # 响应慢
            fi
        else
            return 3  # 响应内容异常
        fi
    else
        echo "HTTP请求失败 (exit code: $curl_exit_code)"
        return 1  # HTTP请求失败
    fi
}

# 网络连接检查
check_network_connections() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        return 1
    fi
    
    # 检查进程的网络连接
    local connections=$(netstat -anp 2>/dev/null | grep "$pid" | wc -l)
    local listening=$(netstat -anp 2>/dev/null | grep "$pid" | grep LISTEN | wc -l)
    local established=$(netstat -anp 2>/dev/null | grep "$pid" | grep ESTABLISHED | wc -l)
    
    printf "连接总数: $connections, 监听: $listening, 已建立: $established"
    
    # 检查是否在监听指定端口
    if netstat -anp 2>/dev/null | grep "$pid" | grep LISTEN | grep -q ":$port "; then
        return 0
    else
        return 1  # 没有监听指定端口
    fi
}

# 计算健康度评分
calculate_health_score() {
    local port="$1"
    local score=0
    local max_score=100
    local checks_performed=0
    local check_results=()
    
    # 进程存活检查 (25分)
    if get_process_info "$port" >/dev/null 2>&1; then
        score=$((score + 25))
        check_results+=("process_alive:pass")
    else
        check_results+=("process_alive:fail")
    fi
    checks_performed=$((checks_performed + 1))
    
    # HTTP健康检查 (25分)
    local http_result
    check_response_time "$port" >/dev/null 2>&1
    http_result=$?
    case $http_result in
        0) 
            score=$((score + 25))
            check_results+=("http_health:pass")
            ;;
        2) 
            score=$((score + 15))  # 部分分数
            check_results+=("http_health:slow")
            ;;
        3)
            score=$((score + 10))  # 部分分数  
            check_results+=("http_health:unhealthy")
            ;;
        *)
            check_results+=("http_health:fail")
            ;;
    esac
    checks_performed=$((checks_performed + 1))
    
    # 内存使用检查 (20分)
    local memory_result
    check_memory_detailed "$port" >/dev/null 2>&1
    memory_result=$?
    case $memory_result in
        0)
            score=$((score + 20))
            check_results+=("memory:pass")
            ;;
        2)
            score=$((score + 10))  # 部分分数
            check_results+=("memory:high")
            ;;
        *)
            check_results+=("memory:fail")
            ;;
    esac
    checks_performed=$((checks_performed + 1))
    
    # CPU使用检查 (15分)
    local cpu_result
    check_cpu_usage "$port" >/dev/null 2>&1
    cpu_result=$?
    case $cpu_result in
        0)
            score=$((score + 15))
            check_results+=("cpu:pass")
            ;;
        2)
            score=$((score + 8))  # 部分分数
            check_results+=("cpu:high")
            ;;
        *)
            check_results+=("cpu:fail")
            ;;
    esac
    checks_performed=$((checks_performed + 1))
    
    # 网络连接检查 (15分)
    if check_network_connections "$port" >/dev/null 2>&1; then
        score=$((score + 15))
        check_results+=("network:pass")
    else
        check_results+=("network:fail")
    fi
    checks_performed=$((checks_performed + 1))
    
    # 输出评分结果
    echo "$score|${check_results[*]}"
    
    # 返回是否健康
    if [[ $score -ge $MIN_HEALTH_SCORE ]]; then
        return 0
    else
        return 1
    fi
}

# 执行快速检查
quick_check() {
    local port="$1"
    
    printf "${BLUE}端口 $port 快速健康检查:${NC}\n"
    
    # PID检查
    printf "  进程状态: "
    if get_process_info "$port" >/dev/null 2>&1; then
        printf "${GREEN}运行中${NC}\n"
    else
        printf "${RED}异常${NC}\n"
        return 1
    fi
    
    # HTTP检查
    printf "  HTTP状态: "
    local response_info
    response_info=$(check_response_time "$port" 2>&1)
    local http_result=$?
    case $http_result in
        0) printf "${GREEN}正常${NC} ($response_info)\n" ;;
        2) printf "${YELLOW}响应慢${NC} ($response_info)\n" ;;
        3) printf "${YELLOW}响应异常${NC} ($response_info)\n" ;;
        *) printf "${RED}失败${NC} ($response_info)\n" ;;
    esac
    
    return $http_result
}

# 执行详细检查
detailed_check() {
    local port="$1"
    
    printf "${BLUE}端口 $port 详细健康检查:${NC}\n"
    
    # 基本进程信息
    printf "  ${PURPLE}进程信息:${NC}\n"
    local process_info
    process_info=$(get_process_info "$port" 2>&1)
    if [[ $? -eq 0 ]]; then
        printf "    $process_info\n"
    else
        printf "    ${RED}$process_info${NC}\n"
        return 1
    fi
    
    # CPU使用率
    printf "  ${PURPLE}CPU使用率:${NC} "
    local cpu_info
    cpu_info=$(check_cpu_usage "$port" 2>&1)
    local cpu_result=$?
    case $cpu_result in
        0) printf "${GREEN}${cpu_info}%%${NC}\n" ;;
        2) printf "${YELLOW}${cpu_info}%% (过高)${NC}\n" ;;
        *) printf "${RED}无法获取${NC}\n" ;;
    esac
    
    # 内存使用
    printf "  ${PURPLE}内存使用:${NC} "
    local memory_info
    memory_info=$(check_memory_detailed "$port" 2>&1)
    local memory_result=$?
    case $memory_result in
        0) printf "${GREEN}$memory_info${NC}\n" ;;
        2) printf "${YELLOW}$memory_info (过高)${NC}\n" ;;
        *) printf "${RED}无法获取${NC}\n" ;;
    esac
    
    # HTTP响应
    printf "  ${PURPLE}HTTP响应:${NC} "
    local response_info
    response_info=$(check_response_time "$port" 2>&1)
    local http_result=$?
    case $http_result in
        0) printf "${GREEN}$response_info${NC}\n" ;;
        2) printf "${YELLOW}$response_info (慢)${NC}\n" ;;
        3) printf "${YELLOW}$response_info (异常)${NC}\n" ;;
        *) printf "${RED}$response_info${NC}\n" ;;
    esac
    
    # 网络连接
    printf "  ${PURPLE}网络连接:${NC} "
    local network_info
    network_info=$(check_network_connections "$port" 2>&1)
    if [[ $? -eq 0 ]]; then
        printf "${GREEN}$network_info${NC}\n"
    else
        printf "${RED}$network_info${NC}\n"
    fi
    
    return 0
}

# 输出JSON格式结果
output_json() {
    local port="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 获取各项检查结果
    local process_alive=false
    local cpu_usage=""
    local memory_info=""
    local response_time=""
    local network_status=""
    local health_score=""
    
    if get_process_info "$port" >/dev/null 2>&1; then
        process_alive=true
    fi
    
    cpu_usage=$(check_cpu_usage "$port" 2>/dev/null || echo "unknown")
    memory_info=$(check_memory_detailed "$port" 2>/dev/null || echo "unknown")
    response_time=$(check_response_time "$port" 2>/dev/null || echo "unknown")
    network_status=$(check_network_connections "$port" 2>/dev/null || echo "unknown")
    
    local score_info
    score_info=$(calculate_health_score "$port" 2>/dev/null)
    local score_result=$?
    health_score=$(echo "$score_info" | cut -d'|' -f1)
    local check_details=$(echo "$score_info" | cut -d'|' -f2)
    
    # 构建JSON输出
    cat << EOF
{
  "timestamp": "$timestamp",
  "port": $port,
  "process_alive": $process_alive,
  "cpu_usage": "$cpu_usage",
  "memory_info": "$memory_info",
  "response_time": "$response_time",
  "network_status": "$network_status",
  "health_score": $health_score,
  "is_healthy": $([ $score_result -eq 0 ] && echo "true" || echo "false"),
  "check_details": "$check_details"
}
EOF
}

# 主函数
main() {
    local mode="quick"
    local target_ports=()
    local output_format="text"
    local show_score=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all|-a)
                for port in $(seq $START_PORT $END_PORT); do
                    target_ports+=("$port")
                done
                shift
                ;;
            --port|-p)
                if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                    target_ports+=("$2")
                    shift 2
                else
                    printf "${RED}错误: --port 需要一个有效的端口号${NC}\n"
                    exit 1
                fi
                ;;
            --quick|-q)
                mode="quick"
                shift
                ;;
            --detailed|-d)
                mode="detailed"
                shift
                ;;
            --score|-s)
                show_score=true
                shift
                ;;
            --json)
                output_format="json"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                if [[ "$1" =~ ^[0-9]+$ ]]; then
                    target_ports+=("$1")
                else
                    printf "${RED}错误: 未知参数 '$1'${NC}\n"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 如果没有指定端口，默认检查所有端口
    if [[ ${#target_ports[@]} -eq 0 ]]; then
        for port in $(seq $START_PORT $END_PORT); do
            target_ports+=("$port")
        done
    fi
    
    # 执行健康检查
    local total_ports=${#target_ports[@]}
    local healthy_count=0
    
    for port in "${target_ports[@]}"; do
        if [[ "$output_format" == "json" ]]; then
            output_json "$port"
        else
            case $mode in
                "quick")
                    if quick_check "$port"; then
                        healthy_count=$((healthy_count + 1))
                    fi
                    ;;
                "detailed")
                    if detailed_check "$port"; then
                        healthy_count=$((healthy_count + 1))
                    fi
                    ;;
            esac
            
            if [[ "$show_score" == "true" ]]; then
                printf "  ${PURPLE}健康度评分:${NC} "
                local score_info
                score_info=$(calculate_health_score "$port" 2>/dev/null)
                local score_result=$?
                local score=$(echo "$score_info" | cut -d'|' -f1)
                
                if [[ $score_result -eq 0 ]]; then
                    printf "${GREEN}$score/100 (健康)${NC}\n"
                else
                    printf "${RED}$score/100 (不健康)${NC}\n"
                fi
            fi
            
            printf "\n"
        fi
    done
    
    # 显示总结
    if [[ "$output_format" != "json" ]]; then
        printf "${BLUE}健康检查总结:${NC}\n"
        printf "  总端口数: $total_ports\n"
        printf "  健康端口: ${GREEN}$healthy_count${NC}\n"
        printf "  异常端口: ${RED}$((total_ports - healthy_count))${NC}\n"
        
        if [[ $healthy_count -eq $total_ports ]]; then
            printf "  ${GREEN}✅ 所有服务运行正常${NC}\n"
        else
            printf "  ${YELLOW}⚠️  部分服务存在问题${NC}\n"
        fi
    fi
}

# 检查依赖
if ! command -v curl >/dev/null 2>&1; then
    printf "${RED}❌ 错误: 需要安装curl命令${NC}\n"
    exit 1
fi

if ! command -v bc >/dev/null 2>&1; then
    printf "${RED}❌ 错误: 需要安装bc命令${NC}\n"
    exit 1
fi

# 运行主函数
main "$@"