#!/bin/bash

# 重启管理器
# 负责执行智能重启逻辑和重试策略

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置参数
START_PORT=${START_PORT:-8000}
END_PORT=${END_PORT:-8030}
PID_DIR=${PID_DIR:-"pids"}
LOG_DIR=${LOG_DIR:-"logs"}
SCRIPT_PATH=${SCRIPT_PATH:-"src/server.ts"}
RESTART_LOG="$LOG_DIR/restart.log"

# 重启策略配置
QUICK_RETRY_COUNT=${QUICK_RETRY_COUNT:-3}
QUICK_RETRY_INTERVAL=${QUICK_RETRY_INTERVAL:-5}
MEDIUM_RETRY_COUNT=${MEDIUM_RETRY_COUNT:-3}
MEDIUM_RETRY_INTERVAL=${MEDIUM_RETRY_INTERVAL:-30}
SLOW_RETRY_COUNT=${SLOW_RETRY_COUNT:-3}
SLOW_RETRY_INTERVAL=${SLOW_RETRY_INTERVAL:-300}
MAX_TOTAL_RETRIES=${MAX_TOTAL_RETRIES:-10}

# 健康检查配置
RESTART_VERIFICATION_TIMEOUT=${RESTART_VERIFICATION_TIMEOUT:-30}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-5}

# 高性能配置参数
MAX_HEAP_SIZE=${MAX_HEAP_SIZE:-"2048m"}
MAX_OLD_SPACE=${MAX_OLD_SPACE:-"1600m"}
INITIAL_HEAP_SIZE=${INITIAL_HEAP_SIZE:-"512m"}

# 创建必要目录
mkdir -p "$PID_DIR" "$LOG_DIR"

# 日志记录函数
log_restart_event() {
    local level="$1"
    local port="$2"
    local event="$3"
    local details="$4"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local log_entry="[$timestamp] [$level] Port $port: $event - $details"
    echo "$log_entry" >> "$RESTART_LOG"
    
    if [[ "$level" == "ERROR" ]]; then
        printf "${RED}$log_entry${NC}\n"
    elif [[ "$level" == "WARN" ]]; then
        printf "${YELLOW}$log_entry${NC}\n"
    elif [[ "$level" == "INFO" ]]; then
        printf "${GREEN}$log_entry${NC}\n"
    else
        printf "$log_entry\n"
    fi
}

# 检查系统资源是否充足
check_system_resources() {
    local port="$1"
    
    # 检查可用内存
    local available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    local required_memory=2200  # 每个进程约需2.2GB
    
    if [[ $available_memory -lt $required_memory ]]; then
        log_restart_event "WARN" "$port" "insufficient_memory" "available=${available_memory}MB, required=${required_memory}MB"
        return 1
    fi
    
    # 检查端口是否被占用
    if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        # 检查是否是我们自己的进程占用
        local existing_pid=$(lsof -ti:$port 2>/dev/null)
        if [[ -n "$existing_pid" ]]; then
            local pid_file="$PID_DIR/server-$port.pid"
            if [[ -f "$pid_file" ]]; then
                local recorded_pid=$(cat "$pid_file" 2>/dev/null)
                if [[ "$existing_pid" != "$recorded_pid" ]]; then
                    log_restart_event "WARN" "$port" "port_occupied" "occupied_by_pid=$existing_pid"
                    return 2
                fi
            else
                log_restart_event "WARN" "$port" "port_occupied" "occupied_by_pid=$existing_pid, no_pid_file"
                return 2
            fi
        fi
    fi
    
    # 检查文件描述符限制
    local current_limit=$(ulimit -n)
    if [[ $current_limit -lt 1024 ]]; then
        log_restart_event "WARN" "$port" "low_fd_limit" "current_limit=$current_limit"
        # 尝试增加限制
        ulimit -n 65536 2>/dev/null || true
    fi
    
    return 0
}

# 清理残留资源
cleanup_port_resources() {
    local port="$1"
    local force="${2:-false}"
    
    log_restart_event "INFO" "$port" "cleaning_resources" "force=$force"
    
    # 清理PID文件
    local pid_file="$PID_DIR/server-$port.pid"
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [[ -n "$pid" ]]; then
            # 检查进程是否还在运行
            if kill -0 "$pid" 2>/dev/null; then
                log_restart_event "INFO" "$port" "killing_existing_process" "pid=$pid"
                
                # 先尝试优雅关闭
                kill -TERM "$pid" 2>/dev/null
                sleep 3
                
                # 如果还在运行，强制杀死
                if kill -0 "$pid" 2>/dev/null; then
                    kill -KILL "$pid" 2>/dev/null
                    sleep 1
                fi
            fi
        fi
        rm -f "$pid_file"
    fi
    
    # 清理可能占用端口的进程
    local port_pids=$(lsof -ti:$port 2>/dev/null)
    if [[ -n "$port_pids" ]]; then
        for pid in $port_pids; do
            if ps -p "$pid" -o comm= 2>/dev/null | grep -q "deno"; then
                log_restart_event "INFO" "$port" "killing_port_process" "pid=$pid"
                kill -TERM "$pid" 2>/dev/null
                sleep 2
                if kill -0 "$pid" 2>/dev/null; then
                    kill -KILL "$pid" 2>/dev/null
                fi
            fi
        done
    fi
    
    # 等待端口释放
    local wait_count=0
    while netstat -an 2>/dev/null | grep -q ":$port.*LISTEN" && [[ $wait_count -lt 10 ]]; do
        sleep 1
        wait_count=$((wait_count + 1))
    done
    
    if netstat -an 2>/dev/null | grep -q ":$port.*LISTEN"; then
        log_restart_event "WARN" "$port" "port_still_occupied" "after_cleanup"
        return 1
    fi
    
    return 0
}

# 启动新进程
start_new_process() {
    local port="$1"
    local attempt="$2"
    
    log_restart_event "INFO" "$port" "starting_new_process" "attempt=$attempt"
    
    # 设置高性能环境变量
    export HIGH_PERFORMANCE_MODE=true
    
    # 启动Deno进程
    HIGH_PERFORMANCE_MODE=true deno run \
        --allow-net \
        --allow-env \
        --allow-read \
        --allow-write \
        --v8-flags="--no-memory-saver-mode,--max-old-space-size=3072,--initial-heap-size=1024,--expose-gc" \
        "$SCRIPT_PATH" "$port" \
        > "$LOG_DIR/server-$port.log" 2>&1 &
    
    local new_pid=$!
    
    # 保存新PID
    echo "$new_pid" > "$PID_DIR/server-$port.pid"
    
    log_restart_event "INFO" "$port" "process_started" "pid=$new_pid"
    
    return 0
}

# 验证重启是否成功
verify_restart_success() {
    local port="$1"
    local timeout="$2"
    
    log_restart_event "INFO" "$port" "verifying_restart" "timeout=${timeout}s"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # 检查进程是否还在运行
        local pid_file="$PID_DIR/server-$port.pid"
        if [[ -f "$pid_file" ]]; then
            local pid=$(cat "$pid_file" 2>/dev/null)
            if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                # 检查HTTP响应
                if curl -s -m 5 "http://localhost:$port/health" 2>/dev/null | grep -q '"status":"healthy"'; then
                    log_restart_event "INFO" "$port" "restart_verified" "success=true"
                    return 0
                fi
            fi
        fi
        
        sleep 2
    done
    
    log_restart_event "ERROR" "$port" "restart_verification_failed" "timeout_reached"
    return 1
}

# 获取重启计数
get_restart_count() {
    local port="$1"
    local count_file="$LOG_DIR/restart_count_$port"
    
    if [[ -f "$count_file" ]]; then
        cat "$count_file"
    else
        echo "0"
    fi
}

# 更新重启计数
update_restart_count() {
    local port="$1"
    local count="$2"
    local count_file="$LOG_DIR/restart_count_$port"
    
    echo "$count" > "$count_file"
}

# 执行渐进式重启
perform_progressive_restart() {
    local port="$1"
    local reason="$2"
    local current_count=$(get_restart_count "$port")
    current_count=$((current_count + 1))
    
    log_restart_event "INFO" "$port" "progressive_restart_started" "reason=$reason, attempt=$current_count"
    
    # 检查是否超过最大重试次数
    if [[ $current_count -gt $MAX_TOTAL_RETRIES ]]; then
        log_restart_event "ERROR" "$port" "max_retries_exceeded" "count=$current_count"
        return 1
    fi
    
    # 确定重试策略
    local retry_interval
    local retry_phase
    
    if [[ $current_count -le $QUICK_RETRY_COUNT ]]; then
        retry_interval=$QUICK_RETRY_INTERVAL
        retry_phase="quick"
    elif [[ $current_count -le $((QUICK_RETRY_COUNT + MEDIUM_RETRY_COUNT)) ]]; then
        retry_interval=$MEDIUM_RETRY_INTERVAL
        retry_phase="medium"
    else
        retry_interval=$SLOW_RETRY_INTERVAL
        retry_phase="slow"
    fi
    
    log_restart_event "INFO" "$port" "restart_strategy" "phase=$retry_phase, interval=${retry_interval}s"
    
    # 检查系统资源
    if ! check_system_resources "$port"; then
        log_restart_event "ERROR" "$port" "insufficient_resources" "restart_aborted"
        return 1
    fi
    
    # 等待冷却时间
    if [[ $retry_interval -gt 0 ]]; then
        log_restart_event "INFO" "$port" "cooling_down" "waiting=${retry_interval}s"
        sleep "$retry_interval"
    fi
    
    # 清理旧资源
    if ! cleanup_port_resources "$port"; then
        log_restart_event "ERROR" "$port" "cleanup_failed" "restart_aborted"
        return 1
    fi
    
    # 启动新进程
    if ! start_new_process "$port" "$current_count"; then
        log_restart_event "ERROR" "$port" "start_failed" "restart_aborted"
        return 1
    fi
    
    # 验证重启成功
    if verify_restart_success "$port" "$RESTART_VERIFICATION_TIMEOUT"; then
        log_restart_event "INFO" "$port" "restart_successful" "attempt=$current_count"
        # 重置计数器（重启成功后）
        update_restart_count "$port" "0"
        return 0
    else
        log_restart_event "ERROR" "$port" "restart_failed" "attempt=$current_count"
        update_restart_count "$port" "$current_count"
        return 1
    fi
}

# 显示使用说明
show_usage() {
    printf "${BLUE}重启管理器使用说明${NC}\n"
    printf "用法: bash scripts/restart-manager.sh <端口> [原因] [选项]\n\n"
    printf "参数:\n"
    printf "  端口          要重启的服务端口号\n"
    printf "  原因          重启原因（可选）\n\n"
    printf "选项:\n"
    printf "  --force       强制重启（跳过资源检查）\n"
    printf "  --quick       使用快速重试策略\n"
    printf "  --reset-count 重置重启计数器\n"
    printf "  --dry-run     模拟运行（不实际重启）\n"
    printf "  --help        显示此帮助信息\n\n"
    printf "示例:\n"
    printf "  $0 8015 memory_overflow\n"
    printf "  $0 8020 --force\n"
    printf "  $0 8025 health_check_failed --reset-count\n"
}

# 主函数
main() {
    local port=""
    local reason="manual_restart"
    local force_restart=false
    local reset_count=false
    local dry_run=false
    local quick_restart=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                force_restart=true
                shift
                ;;
            --quick)
                quick_restart=true
                shift
                ;;
            --reset-count)
                reset_count=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            [0-9]*)
                # 端口号
                if [[ -z "$port" ]]; then
                    port="$1"
                else
                    printf "${RED}错误: 端口号已指定 '$port'，不能重复指定 '$1'${NC}\n"
                    show_usage
                    exit 1
                fi
                shift
                ;;
            *)
                # 重启原因
                if [[ -n "$port" && "$reason" == "manual_restart" ]]; then
                    reason="$1"
                else
                    printf "${RED}错误: 未知参数 '$1'${NC}\n"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 验证端口参数
    if [[ -z "$port" ]]; then
        printf "${RED}错误: 必须指定端口号${NC}\n"
        show_usage
        exit 1
    fi
    
    if [[ $port -lt $START_PORT || $port -gt $END_PORT ]]; then
        printf "${RED}错误: 端口号必须在 $START_PORT-$END_PORT 范围内${NC}\n"
        exit 1
    fi
    
    # 重置重启计数器
    if [[ "$reset_count" == "true" ]]; then
        update_restart_count "$port" "0"
        log_restart_event "INFO" "$port" "restart_count_reset" ""
        printf "${GREEN}已重置端口 $port 的重启计数器${NC}\n"
        if [[ "$dry_run" == "true" ]]; then
            exit 0
        fi
    fi
    
    # 模拟运行
    if [[ "$dry_run" == "true" ]]; then
        printf "${YELLOW}模拟运行模式 - 不会实际重启进程${NC}\n"
        printf "端口: $port\n"
        printf "原因: $reason\n"
        printf "当前重启次数: $(get_restart_count "$port")\n"
        printf "强制重启: $force_restart\n"
        exit 0
    fi
    
    # 检查脚本文件是否存在
    if [[ ! -f "$SCRIPT_PATH" ]]; then
        log_restart_event "ERROR" "$port" "script_not_found" "path=$SCRIPT_PATH"
        printf "${RED}错误: 找不到服务脚本文件 $SCRIPT_PATH${NC}\n"
        exit 1
    fi
    
    # 执行重启
    printf "${BLUE}开始重启端口 $port 的服务...${NC}\n"
    printf "原因: $reason\n"
    printf "当前重启次数: $(get_restart_count "$port")\n"
    
    if [[ "$force_restart" == "true" ]]; then
        log_restart_event "INFO" "$port" "force_restart_requested" "reason=$reason"
        
        # 强制重启：跳过部分检查
        cleanup_port_resources "$port" "true"
        start_new_process "$port" "force"
        
        if verify_restart_success "$port" "$RESTART_VERIFICATION_TIMEOUT"; then
            printf "${GREEN}✅ 强制重启成功${NC}\n"
            exit 0
        else
            printf "${RED}❌ 强制重启失败${NC}\n"
            exit 1
        fi
    else
        # 正常渐进式重启
        if perform_progressive_restart "$port" "$reason"; then
            printf "${GREEN}✅ 重启成功${NC}\n"
            exit 0
        else
            printf "${RED}❌ 重启失败${NC}\n"
            exit 1
        fi
    fi
}

# 运行主函数
main "$@"