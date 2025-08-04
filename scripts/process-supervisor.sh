#!/bin/bash

# 进程监控守护脚本
# 负责监控高性能集群中所有服务进程的健康状态并触发自动重启

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 监控配置
START_PORT=${START_PORT:-8000}
END_PORT=${END_PORT:-8030}
PID_DIR=${PID_DIR:-"pids"}
LOG_DIR=${LOG_DIR:-"logs"}
SUPERVISOR_LOG="$LOG_DIR/supervisor.log"
RESTART_LOG="$LOG_DIR/restart.log"

# 监控间隔配置（秒）
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10}
PID_CHECK_INTERVAL=${PID_CHECK_INTERVAL:-5}
MEMORY_CHECK_INTERVAL=${MEMORY_CHECK_INTERVAL:-15}

# 健康阈值配置
MAX_MEMORY_PERCENT=${MAX_MEMORY_PERCENT:-85}
MAX_RESPONSE_TIME=${MAX_RESPONSE_TIME:-5000}
MAX_CONSECUTIVE_FAILURES=${MAX_CONSECUTIVE_FAILURES:-3}

# 重启配置
QUICK_RETRY_COUNT=${QUICK_RETRY_COUNT:-3}
QUICK_RETRY_INTERVAL=${QUICK_RETRY_INTERVAL:-5}
MEDIUM_RETRY_COUNT=${MEDIUM_RETRY_COUNT:-3} 
MEDIUM_RETRY_INTERVAL=${MEDIUM_RETRY_INTERVAL:-30}
MAX_TOTAL_RETRIES=${MAX_TOTAL_RETRIES:-10}

# 全局状态变量
declare -A process_status
declare -A failure_count
declare -A restart_count
declare -A last_health_check
declare -A memory_usage_history

# 创建必要目录
mkdir -p "$LOG_DIR"

# 日志记录函数
log_event() {
    local level="$1"
    local port="$2"
    local event="$3"
    local details="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local log_entry="{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"port\":$port,\"event\":\"$event\",\"details\":\"$details\"}"
    echo "$log_entry" >> "$SUPERVISOR_LOG"
    
    if [[ "$level" == "ERROR" || "$level" == "WARN" ]]; then
        printf "${RED}[$timestamp]${NC} Port $port: $event - $details\n"
    elif [[ "$level" == "INFO" ]]; then
        printf "${GREEN}[$timestamp]${NC} Port $port: $event\n"
    fi
}

# 检查进程PID是否存活
check_pid_alive() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        return 1
    fi
    
    # 检查进程是否存在且为我们的进程
    if kill -0 "$pid" 2>/dev/null; then
        # 进一步验证是否是我们的deno进程
        if ps -p "$pid" -o comm= 2>/dev/null | grep -q "deno"; then
            return 0
        fi
    fi
    
    return 1
}

# HTTP健康检查
check_http_health() {
    local port="$1"
    local start_time=$(date +%s%3N)
    
    # 使用curl进行健康检查，设置超时
    local response=$(curl -s -m 5 "http://localhost:$port/health" 2>/dev/null)
    local curl_exit_code=$?
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [[ $curl_exit_code -eq 0 ]]; then
        # 检查响应内容是否包含健康状态
        if echo "$response" | grep -q '"status":"healthy"'; then
            if [[ $response_time -le $MAX_RESPONSE_TIME ]]; then
                return 0
            else
                log_event "WARN" "$port" "slow_response" "response_time=${response_time}ms"
                return 2  # 响应慢
            fi
        else
            log_event "WARN" "$port" "unhealthy_response" "response=$response"
            return 3  # 响应不健康
        fi
    else
        log_event "WARN" "$port" "http_check_failed" "curl_exit_code=$curl_exit_code"
        return 1  # HTTP请求失败
    fi
}

# 内存使用检查
check_memory_usage() {
    local port="$1"
    local pid_file="$PID_DIR/server-$port.pid"
    
    if [[ ! -f "$pid_file" ]]; then
        return 1
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -z "$pid" ]]; then
        return 1
    fi
    
    # 获取进程内存使用情况 (KB)
    local memory_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
    if [[ -z "$memory_kb" || "$memory_kb" == "0" ]]; then
        return 1
    fi
    
    local memory_mb=$((memory_kb / 1024))
    
    # 记录内存使用历史（保留最近5次）
    if [[ -z "${memory_usage_history[$port]}" ]]; then
        memory_usage_history[$port]="$memory_mb"
    else
        local history="${memory_usage_history[$port]}"
        local count=$(echo "$history" | tr ',' ' ' | wc -w)
        if [[ $count -ge 5 ]]; then
            # 删除最老的记录
            history=$(echo "$history" | cut -d',' -f2-)
        fi
        memory_usage_history[$port]="$history,$memory_mb"
    fi
    
    # 获取系统总内存
    local total_memory=$(free -m | awk 'NR==2{print $2}')
    local memory_percent=$((memory_mb * 100 / total_memory))
    
    if [[ $memory_percent -gt $MAX_MEMORY_PERCENT ]]; then
        log_event "WARN" "$port" "high_memory_usage" "memory=${memory_mb}MB (${memory_percent}%)"
        return 2  # 内存使用过高
    fi
    
    return 0
}

# 综合健康检查
perform_health_check() {
    local port="$1"
    local health_score=0
    local issues=()
    
    # PID检查（权重：40%）
    if ! check_pid_alive "$port"; then
        issues+=("process_dead")
        log_event "ERROR" "$port" "process_dead" ""
        return 1  # 进程死亡，直接返回失败
    fi
    health_score=$((health_score + 40))
    
    # HTTP健康检查（权重：35%）
    local http_result
    check_http_health "$port"
    http_result=$?
    case $http_result in
        0) health_score=$((health_score + 35)) ;;
        2) 
            issues+=("slow_response")
            health_score=$((health_score + 15))  # 部分分数
            ;;
        *) issues+=("http_failed") ;;
    esac
    
    # 内存检查（权重：25%）
    local memory_result
    check_memory_usage "$port"
    memory_result=$?
    case $memory_result in
        0) health_score=$((health_score + 25)) ;;
        2) 
            issues+=("high_memory")
            health_score=$((health_score + 10))  # 部分分数
            ;;
        *) issues+=("memory_check_failed") ;;
    esac
    
    # 更新健康检查时间
    last_health_check[$port]=$(date +%s)
    
    # 健康度评分：80分以上为健康
    if [[ $health_score -ge 80 ]]; then
        if [[ ${#issues[@]} -eq 0 ]]; then
            log_event "DEBUG" "$port" "health_check_passed" "score=$health_score"
        else
            log_event "INFO" "$port" "health_check_warning" "score=$health_score, issues=${issues[*]}"
        fi
        return 0
    else
        log_event "WARN" "$port" "health_check_failed" "score=$health_score, issues=${issues[*]}"
        return 1
    fi
}

# 触发进程重启
trigger_restart() {
    local port="$1"
    local reason="$2"
    
    # 增加重启计数
    restart_count[$port]=$((${restart_count[$port]:-0} + 1))
    
    if [[ ${restart_count[$port]} -gt $MAX_TOTAL_RETRIES ]]; then
        log_event "ERROR" "$port" "max_retries_exceeded" "count=${restart_count[$port]}"
        process_status[$port]="failed"
        return 1
    fi
    
    log_event "INFO" "$port" "triggering_restart" "reason=$reason, attempt=${restart_count[$port]}"
    
    # 记录重启事件到专门的重启日志
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] Port $port restart #${restart_count[$port]} - Reason: $reason" >> "$RESTART_LOG"
    
    # 调用重启管理器
    bash scripts/restart-manager.sh "$port" "$reason" &
    
    process_status[$port]="restarting"
    failure_count[$port]=0  # 重置失败计数
    
    return 0
}

# 更新进程状态
update_process_status() {
    local port="$1"
    
    if perform_health_check "$port"; then
        # 健康检查通过
        if [[ "${process_status[$port]}" != "healthy" ]]; then
            log_event "INFO" "$port" "process_recovered" ""
            process_status[$port]="healthy"
            failure_count[$port]=0
        fi
    else
        # 健康检查失败
        failure_count[$port]=$((${failure_count[$port]:-0} + 1))
        
        if [[ ${failure_count[$port]} -ge $MAX_CONSECUTIVE_FAILURES ]]; then
            if [[ "${process_status[$port]}" != "restarting" && "${process_status[$port]}" != "failed" ]]; then
                trigger_restart "$port" "consecutive_health_failures"
            fi
        else
            process_status[$port]="unhealthy"
            log_event "WARN" "$port" "health_check_failed" "consecutive_failures=${failure_count[$port]}"
        fi
    fi
}

# 监控主循环
monitoring_loop() {
    local cycle_count=0
    
    printf "${PURPLE}🔍 启动进程监控守护程序${NC}\n"
    printf "${YELLOW}   监控端口范围: $START_PORT-$END_PORT${NC}\n"
    printf "${YELLOW}   健康检查间隔: ${HEALTH_CHECK_INTERVAL}秒${NC}\n"
    printf "${YELLOW}   最大重试次数: $MAX_TOTAL_RETRIES${NC}\n"
    printf "\n"
    
    # 初始化所有进程状态
    for port in $(seq $START_PORT $END_PORT); do
        process_status[$port]="unknown"
        failure_count[$port]=0
        restart_count[$port]=0
    done
    
    while true; do
        cycle_count=$((cycle_count + 1))
        
        # 每隔一定周期显示监控状态摘要
        if [[ $((cycle_count % 6)) -eq 0 ]]; then  # 每分钟显示一次摘要
            display_monitoring_summary
        fi
        
        # 检查所有端口
        for port in $(seq $START_PORT $END_PORT); do
            update_process_status "$port"
        done
        
        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# 显示监控状态摘要
display_monitoring_summary() {
    local healthy_count=0
    local unhealthy_count=0
    local restarting_count=0
    local failed_count=0
    
    printf "\n${BLUE}📊 监控状态摘要 - $(date '+%H:%M:%S')${NC}\n"
    
    for port in $(seq $START_PORT $END_PORT); do
        case "${process_status[$port]}" in
            "healthy") healthy_count=$((healthy_count + 1)) ;;
            "unhealthy") unhealthy_count=$((unhealthy_count + 1)) ;;
            "restarting") restarting_count=$((restarting_count + 1)) ;;
            "failed") failed_count=$((failed_count + 1)) ;;
        esac
    done
    
    printf "   ${GREEN}健康: $healthy_count${NC} | ${YELLOW}异常: $unhealthy_count${NC} | ${BLUE}重启中: $restarting_count${NC} | ${RED}失败: $failed_count${NC}\n"
    
    # 显示问题端口详情
    if [[ $unhealthy_count -gt 0 || $restarting_count -gt 0 || $failed_count -gt 0 ]]; then
        printf "   ${YELLOW}问题端口:${NC}"
        for port in $(seq $START_PORT $END_PORT); do
            if [[ "${process_status[$port]}" != "healthy" ]]; then
                local status_color
                case "${process_status[$port]}" in
                    "unhealthy") status_color=$YELLOW ;;
                    "restarting") status_color=$BLUE ;;
                    "failed") status_color=$RED ;;
                    *) status_color=$NC ;;
                esac
                printf " ${status_color}$port(${process_status[$port]})${NC}"
            fi
        done
        printf "\n"
    fi
}

# 优雅关闭处理
cleanup_supervisor() {
    printf "\n${RED}🛑 停止进程监控守护程序...${NC}\n"
    log_event "INFO" "supervisor" "supervisor_stopping" ""
    
    # 等待正在进行的健康检查完成
    sleep 2
    
    printf "${GREEN}✅ 进程监控守护程序已停止${NC}\n"
    exit 0
}

# 捕获中断信号
trap cleanup_supervisor INT TERM

# 检查必要的依赖
if ! command -v curl >/dev/null 2>&1; then
    printf "${RED}❌ 错误: 需要安装curl命令${NC}\n"
    exit 1
fi

# 启动监控主循环
monitoring_loop