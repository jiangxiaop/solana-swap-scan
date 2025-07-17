# Solana Swap Scan 集群部署指南

## 🚀 概述

由于Deno单线程的限制，此项目实现了一个多进程集群架构来提高并发处理能力：

- **31个 Deno 进程**：30个工作进程（端口8000-8030）+ 1个负载均衡器（端口7999）
- **智能负载均衡**：自动健康检查、最少连接分发算法
- **容错机制**：单个进程故障不影响整体服务
- **简化管理**：一键启动/停止整个集群

## 📁 项目结构

```
solana-swap-scan/
├── src/
│   ├── server.ts              # 工作进程服务器（已修改支持端口参数）
│   └── service/
│       └── SolanaBlockDataHandler.ts
├── scripts/
│   ├── start-cluster.sh       # 启动30个工作进程
│   ├── stop-cluster.sh        # 停止所有工作进程
│   ├── start-full-cluster.sh  # 启动完整集群（工作进程+负载均衡器）
│   └── stop-full-cluster.sh   # 停止完整集群
├── load-balancer.ts           # 负载均衡器
├── logs/                      # 日志目录（自动创建）
├── pids/                      # PID文件目录（自动创建）
└── CLUSTER_README.md          # 本文档
```

## 🔧 安装要求

确保你的系统已安装：

```bash
# 安装 Deno
curl -fsSL https://deno.land/x/install/install.sh | sh

# 确保 Deno 在 PATH 中
export PATH="$HOME/.deno/bin:$PATH"

# 验证安装
deno --version
```

## 🎯 快速开始

### 1. 启动完整集群

```bash
# 一键启动：负载均衡器 + 30个工作进程
bash scripts/start-full-cluster.sh
```

启动后你会看到：
- 🚀 30个工作进程（端口8000-8030）
- 🌐 负载均衡器（端口7999）
- 📊 实时健康状态监控

### 2. 使用API

```bash
# 通过负载均衡器调用API
curl -X POST http://localhost:7999/api/parse-blockdata \
     -H "Content-Type: application/json" \
     -d '[{"blocknum": 12345, "blockdata": {...}}]'

# 检查集群状态
curl http://localhost:7999/lb-status

# 健康检查
curl http://localhost:7999/lb-health
```

### 3. 停止集群

```bash
# 一键停止整个集群
bash scripts/stop-full-cluster.sh

# 或者使用 Ctrl+C 中断启动脚本
```

## 🛠️ 高级操作

### 仅启动工作进程（无负载均衡器）

```bash
# 启动30个工作进程
bash scripts/start-cluster.sh

# 停止工作进程
bash scripts/stop-cluster.sh
```

### 自定义负载均衡器端口

```bash
# 启动负载均衡器在端口9000
deno run --allow-net --allow-env load-balancer.ts 9000
```

### 直接访问工作进程

```bash
# 直接调用特定端口的工作进程
curl -X POST http://localhost:8005/api/parse-blockdata \
     -H "Content-Type: application/json" \
     -d '[{"blocknum": 12345, "blockdata": {...}}]'

# 检查特定工作进程健康状态
curl http://localhost:8005/health
```

## 📊 监控和调试

### 查看日志

```bash
# 负载均衡器日志
tail -f logs/load-balancer.log

# 特定工作进程日志
tail -f logs/server-8000.log

# 所有工作进程日志
tail -f logs/server-*.log
```

### 检查进程状态

```bash
# 查看所有相关进程
ps aux | grep deno

# 检查端口占用
netstat -tlnp | grep 800

# 负载均衡器状态详情
curl http://localhost:7999/lb-status | jq
```

### 性能监控

```bash
# 实时监控负载分布
watch -n 1 'curl -s http://localhost:7999/lb-status | jq ".servers[] | {port, isHealthy, requestCount}"'

# 监控系统资源
htop
```

## 🔧 配置说明

### 端口配置

- **负载均衡器**: 7999 (可通过命令行参数修改)
- **工作进程**: 8000-8030 (共31个端口)

### 负载均衡策略

- **算法**: 最少连接数 (Least Connections)
- **健康检查**: 每10秒检查一次
- **超时设置**: 请求30秒超时，健康检查5秒超时
- **故障恢复**: 自动检测并恢复健康的服务器

### 修改配置

要调整端口范围，编辑以下文件：

```bash
# scripts/start-cluster.sh
START_PORT=8000
END_PORT=8030

# load-balancer.ts
new LoadBalancer(8000, 8030)  // startPort, endPort
```

## 🔧 HTTP连接错误修复

最新版本已修复常见的HTTP连接错误：

- **Content-Type验证**：确保请求头正确
- **请求体大小限制**：防止过大请求（100MB限制）  
- **30秒超时保护**：避免长时间挂起
- **连接错误分类**：区分临时错误和服务器故障
- **负载均衡器容错**：单个请求错误不影响服务器健康状态

```bash
# 测试HTTP错误修复
bash scripts/test-http-fix.sh
```

## 🚨 故障排除

### 问题：端口被占用

```bash
# 查找占用端口的进程
sudo lsof -i :8000

# 强制杀死进程
sudo kill -9 <PID>
```

### 问题：部分进程启动失败

```bash
# 检查具体错误
cat logs/server-8001.log

# 检查可用内存
free -h

# 检查文件描述符限制
ulimit -n
```

### 问题：负载均衡器连接不上工作进程

```bash
# 检查防火墙设置
sudo ufw status

# 测试本地连接
curl http://localhost:8000/health

# 检查DNS解析
nslookup localhost
```

### 问题：性能不如预期

1. **检查数据库连接池配置**
2. **监控ClickHouse性能**
3. **调整进程数量**（根据CPU核心数）
4. **优化内存使用**

## 📈 性能优化建议

### 1. 进程数量调优

```bash
# 根据CPU核心数调整
# 一般设置为 CPU核心数 × 2
nproc  # 查看CPU核心数
```

### 2. 系统参数调优

```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 调整TCP参数
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
sysctl -p
```

### 3. 应用层优化

- 调整ClickHouse连接池大小
- 优化SQL查询
- 使用批量插入
- 考虑数据分区策略

## 🔒 安全注意事项

1. **仅监听本地端口**：默认配置只绑定localhost
2. **使用防火墙**：限制外部访问
3. **定期更新依赖**：保持Deno和依赖包最新
4. **监控资源使用**：防止资源耗尽攻击

## 📝 API文档

### 主要端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/parse-blockdata` | POST | 处理区块数据 |
| `/health` | GET | 工作进程健康检查 |
| `/lb-health` | GET | 负载均衡器健康检查 |
| `/lb-status` | GET | 集群状态详情 |

### 请求示例

```json
POST /api/parse-blockdata
Content-Type: application/json

[
  {
    "blocknum": 12345,
    "blockdata": {
      // VersionedBlockResponse 数据
    }
  }
]
```

### 响应示例

```json
{
  "success": true,
  "port": 8005,
  "processedBlocks": 1,
  "processingTime": 1250,
  "data": [
    // 处理结果
  ]
}
```

## 🆘 获取帮助

如果遇到问题：

1. 查看日志文件：`logs/`目录下的所有`.log`文件
2. 检查进程状态：`ps aux | grep deno`
3. 验证网络连接：`curl`测试各个端点
4. 查看系统资源：`htop`, `free -h`, `df -h`

---

🎉 **恭喜！** 你的Solana Swap Scan集群现在可以处理大量并发请求了！ 