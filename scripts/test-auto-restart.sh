#!/bin/bash

# 自动重启机制测试脚本
# 用于验证进程监控、健康检查和自动重启功能

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置参数
TEST_PORT=8015
PID_DIR="pids"
LOG_DIR="logs" 
TEST_LOG="$LOG_DIR/auto-restart-test.log"
TEST_DURATION=60  # 测试持续时间（秒）

printf "${PURPLE}🧪 自动重启机制测试开始${NC}\n"
printf "${YELLOW}   测试端口: $TEST_PORT${NC}\n"
printf "${YELLOW}   测试时长: ${TEST_DURATION}秒${NC}\n"
printf "${YELLOW}   测试日志: $TEST_LOG${NC}\n"
printf "\n"

# 创建测试日志
mkdir -p "$LOG_DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始自动重启机制测试" > "$TEST_LOG"

# 检查依赖
if ! command -v curl >/dev/null 2>&1; then
    printf "${RED}❌ 错误: 需要安装curl${NC}\n"
    exit 1
fi

# 测试1: 健康检查工具测试
printf "${BLUE}📋 测试1: 健康检查工具功能${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始健康检查工具测试" >> "$TEST_LOG"

printf "   检查所有端口健康状态...\n"
bash scripts/health-checker.sh --all --quick > /tmp/health_test.log 2>&1
if [[ $? -eq 0 ]]; then
    printf "   ${GREEN}✅ 健康检查工具运行正常${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 健康检查工具测试通过" >> "$TEST_LOG"
else
    printf "   ${RED}❌ 健康检查工具测试失败${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 健康检查工具测试失败" >> "$TEST_LOG"
    cat /tmp/health_test.log >> "$TEST_LOG"
fi

printf "   检查JSON格式输出...\n"
bash scripts/health-checker.sh --port $TEST_PORT --json > /tmp/json_test.log 2>&1
if echo "$(cat /tmp/json_test.log)" | jq . >/dev/null 2>&1; then
    printf "   ${GREEN}✅ JSON格式输出正常${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] JSON格式输出测试通过" >> "$TEST_LOG"
else
    printf "   ${YELLOW}⚠️  JSON格式可能有问题（jq未安装或格式错误）${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] JSON格式输出测试警告" >> "$TEST_LOG"
fi

printf "\n"

# 测试2: 重启管理器测试
printf "${BLUE}📋 测试2: 重启管理器功能${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始重启管理器测试" >> "$TEST_LOG"

printf "   测试模拟运行功能...\n"
bash scripts/restart-manager.sh $TEST_PORT test_reason --dry-run > /tmp/restart_dry_test.log 2>&1
if [[ $? -eq 0 ]] && grep -q "模拟运行模式" /tmp/restart_dry_test.log; then
    printf "   ${GREEN}✅ 模拟运行功能正常${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启管理器模拟运行测试通过" >> "$TEST_LOG"
else
    printf "   ${RED}❌ 模拟运行功能测试失败${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启管理器模拟运行测试失败" >> "$TEST_LOG"
    cat /tmp/restart_dry_test.log >> "$TEST_LOG"
fi

printf "   测试重启计数器重置...\n"
bash scripts/restart-manager.sh $TEST_PORT --reset-count --dry-run > /tmp/reset_test.log 2>&1
if [[ $? -eq 0 ]]; then
    printf "   ${GREEN}✅ 重启计数器重置功能正常${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启计数器重置测试通过" >> "$TEST_LOG"
else
    printf "   ${RED}❌ 重启计数器重置测试失败${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启计数器重置测试失败" >> "$TEST_LOG"
    cat /tmp/reset_test.log >> "$TEST_LOG"
fi

printf "\n"

# 测试3: 启动带监控的集群
printf "${BLUE}📋 测试3: 启动监控集群并测试自动重启${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始集群启动和自动重启测试" >> "$TEST_LOG"

printf "   启动高性能集群（限制端口范围进行测试）...\n"

# 设置测试端口范围
export START_PORT=8010
export END_PORT=8015
export AUTO_RESTART_ENABLED=true
export SUPERVISOR_ENABLED=true

# 启动集群
timeout $TEST_DURATION bash scripts/high-performance-start.sh > /tmp/cluster_test.log 2>&1 &
cluster_pid=$!

# 等待集群启动
printf "   等待集群启动...\n"
sleep 10

# 检查集群是否启动成功
active_processes=0
for port in $(seq $START_PORT $END_PORT); do
    if [[ -f "$PID_DIR/server-$port.pid" ]]; then
        pid=$(cat "$PID_DIR/server-$port.pid" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            active_processes=$((active_processes + 1))
        fi
    fi
done

if [[ $active_processes -gt 0 ]]; then
    printf "   ${GREEN}✅ 集群启动成功 ($active_processes 个活跃进程)${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 集群启动成功，活跃进程数: $active_processes" >> "$TEST_LOG"
    
    # 测试HTTP健康检查
    printf "   测试HTTP健康检查...\n"
    health_check_success=0
    for port in $(seq $START_PORT $END_PORT); do
        if curl -s -m 5 "http://localhost:$port/health" | grep -q "healthy"; then
            health_check_success=$((health_check_success + 1))
        fi
    done
    
    printf "   ${GREEN}✅ HTTP健康检查: $health_check_success/$((END_PORT - START_PORT + 1)) 个端口响应正常${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] HTTP健康检查完成，正常响应: $health_check_success" >> "$TEST_LOG"
    
    # 测试4: 模拟进程故障
    printf "\n${BLUE}📋 测试4: 模拟进程故障和自动重启${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始进程故障模拟测试" >> "$TEST_LOG"
    
    # 选择一个进程进行故障模拟
    target_port=$TEST_PORT
    if [[ -f "$PID_DIR/server-$target_port.pid" ]]; then
        target_pid=$(cat "$PID_DIR/server-$target_port.pid" 2>/dev/null)
        if [[ -n "$target_pid" ]] && kill -0 "$target_pid" 2>/dev/null; then
            printf "   模拟端口 $target_port 进程故障 (PID: $target_pid)...\n"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 模拟端口 $target_port 进程故障，PID: $target_pid" >> "$TEST_LOG"
            
            # 杀死进程
            kill -KILL "$target_pid" 2>/dev/null
            
            printf "   等待自动重启机制响应...\n"
            sleep 30
            
            # 检查是否自动重启
            if [[ -f "$PID_DIR/server-$target_port.pid" ]]; then
                new_pid=$(cat "$PID_DIR/server-$target_port.pid" 2>/dev/null)
                if [[ -n "$new_pid" ]] && kill -0 "$new_pid" 2>/dev/null && [[ "$new_pid" != "$target_pid" ]]; then
                    printf "   ${GREEN}✅ 自动重启成功！新PID: $new_pid${NC}\n"
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自动重启成功，新PID: $new_pid" >> "$TEST_LOG"
                    
                    # 测试重启后的服务健康状态
                    if curl -s -m 5 "http://localhost:$target_port/health" | grep -q "healthy"; then
                        printf "   ${GREEN}✅ 重启后服务健康状态正常${NC}\n"
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启后服务健康状态正常" >> "$TEST_LOG"
                    else
                        printf "   ${YELLOW}⚠️  重启后服务健康检查失败${NC}\n"
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启后服务健康检查失败" >> "$TEST_LOG"
                    fi
                else
                    printf "   ${RED}❌ 自动重启失败${NC}\n"
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自动重启失败" >> "$TEST_LOG"
                fi
            else
                printf "   ${RED}❌ 自动重启失败 - PID文件不存在${NC}\n"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自动重启失败 - PID文件不存在" >> "$TEST_LOG"
            fi
        else
            printf "   ${YELLOW}⚠️  目标进程不存在或已停止${NC}\n"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 目标进程不存在或已停止" >> "$TEST_LOG"
        fi
    else
        printf "   ${YELLOW}⚠️  目标端口PID文件不存在${NC}\n"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 目标端口PID文件不存在" >> "$TEST_LOG"
    fi
    
else
    printf "   ${RED}❌ 集群启动失败${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 集群启动失败" >> "$TEST_LOG"
    cat /tmp/cluster_test.log >> "$TEST_LOG"
fi

# 等待测试完成或超时
printf "\n   等待测试完成...\n"
wait $cluster_pid 2>/dev/null

printf "\n"

# 测试5: 检查日志文件
printf "${BLUE}📋 测试5: 检查监控和重启日志${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始日志文件检查" >> "$TEST_LOG"

if [[ -f "$LOG_DIR/supervisor.log" ]]; then
    supervisor_events=$(grep -c "health_check\|restart\|process" "$LOG_DIR/supervisor.log" 2>/dev/null || echo "0")
    printf "   ${GREEN}✅ 监控日志文件存在，包含 $supervisor_events 个相关事件${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 监控日志检查完成，事件数: $supervisor_events" >> "$TEST_LOG"
else
    printf "   ${YELLOW}⚠️  监控日志文件不存在${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 监控日志文件不存在" >> "$TEST_LOG"
fi

if [[ -f "$LOG_DIR/restart.log" ]]; then
    restart_events=$(wc -l < "$LOG_DIR/restart.log" 2>/dev/null || echo "0")
    printf "   ${GREEN}✅ 重启日志文件存在，包含 $restart_events 个重启事件${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启日志检查完成，重启事件数: $restart_events" >> "$TEST_LOG"
else
    printf "   ${YELLOW}⚠️  重启日志文件不存在${NC}\n"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 重启日志文件不存在" >> "$TEST_LOG"
fi

printf "\n"

# 清理测试环境
printf "${BLUE}🧹 清理测试环境${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始清理测试环境" >> "$TEST_LOG"

# 停止所有测试进程
for port in $(seq $START_PORT $END_PORT); do
    if [[ -f "$PID_DIR/server-$port.pid" ]]; then
        pid=$(cat "$PID_DIR/server-$port.pid" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
        rm -f "$PID_DIR/server-$port.pid"
    fi
done

# 停止监控进程
if [[ -f "$PID_DIR/supervisor.pid" ]]; then
    supervisor_pid=$(cat "$PID_DIR/supervisor.pid" 2>/dev/null)
    if [[ -n "$supervisor_pid" ]] && kill -0 "$supervisor_pid" 2>/dev/null; then
        kill -TERM "$supervisor_pid" 2>/dev/null
        sleep 2
        if kill -0 "$supervisor_pid" 2>/dev/null; then
            kill -KILL "$supervisor_pid" 2>/dev/null
        fi
    fi
    rm -f "$PID_DIR/supervisor.pid"
fi

# 清理临时文件
rm -f /tmp/health_test.log /tmp/json_test.log /tmp/restart_dry_test.log /tmp/reset_test.log /tmp/cluster_test.log

printf "${GREEN}✅ 测试环境清理完成${NC}\n"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 测试环境清理完成" >> "$TEST_LOG"

printf "\n"

# 显示测试总结
printf "${PURPLE}📊 自动重启机制测试总结${NC}\n"
printf "========================================\n"
printf "测试时间: $(date '+%Y-%m-%d %H:%M:%S')\n"
printf "测试日志: $TEST_LOG\n"
printf "\n"
printf "${GREEN}✅ 完成的测试项目:${NC}\n"
printf "   • 健康检查工具功能测试\n"
printf "   • 重启管理器功能测试\n"
printf "   • 集群启动和监控测试\n"
printf "   • 进程故障模拟和自动重启测试\n"
printf "   • 监控和重启日志检查\n"
printf "\n"
printf "${BLUE}📝 查看详细测试结果:${NC}\n"
printf "   • 完整测试日志: ${YELLOW}cat $TEST_LOG${NC}\n"
printf "   • 监控日志: ${YELLOW}cat $LOG_DIR/supervisor.log${NC}\n"
printf "   • 重启历史: ${YELLOW}cat $LOG_DIR/restart.log${NC}\n"
printf "\n"
printf "${GREEN}🎉 自动重启机制测试完成！${NC}\n"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 自动重启机制测试完成" >> "$TEST_LOG"