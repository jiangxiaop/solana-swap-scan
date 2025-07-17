/// Solana Swap Scan Load Balancer
/// 将请求分发到多个Deno进程以提高并发处理能力

interface ServerInstance {
    port: number;
    url: string;
    isHealthy: boolean;
    requestCount: number;
    lastUsed: number;
}

class LoadBalancer {
    private servers: ServerInstance[] = [];
    private currentIndex = 0;
    private healthCheckInterval: any;

    constructor(startPort = 8000, endPort = 8030, healthCheckIntervalMs = 10000) {
        // 初始化服务器列表
        for (let port = startPort; port <= endPort; port++) {
            this.servers.push({
                port,
                url: `http://localhost:${port}`,
                isHealthy: true,
                requestCount: 0,
                lastUsed: 0
            });
        }

        // 启动健康检查
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, healthCheckIntervalMs);

        console.log(`🚀 Load Balancer initialized with ${this.servers.length} servers`);
    }

    // 健康检查
    private async performHealthCheck() {
        const healthPromises = this.servers.map(async (server) => {
            try {
                const response = await fetch(`${server.url}/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000) // 5秒超时
                });

                if (response.ok) {
                    if (!server.isHealthy) {
                        console.log(`✅ Server on port ${server.port} is back online`);
                    }
                    server.isHealthy = true;
                } else {
                    throw new Error(`Health check failed with status: ${response.status}`);
                }
            } catch (error) {
                if (server.isHealthy) {
                    console.log(`❌ Server on port ${server.port} is down: ${error.message}`);
                }
                server.isHealthy = false;
            }
        });

        await Promise.allSettled(healthPromises);
    }

    // 获取健康的服务器
    private getHealthyServers(): ServerInstance[] {
        return this.servers.filter(server => server.isHealthy);
    }

    // 轮询算法选择服务器
    private selectServerRoundRobin(): ServerInstance | null {
        const healthyServers = this.getHealthyServers();

        if (healthyServers.length === 0) {
            return null;
        }

        const server = healthyServers[this.currentIndex % healthyServers.length];
        this.currentIndex = (this.currentIndex + 1) % healthyServers.length;

        return server;
    }

    // 最少连接算法选择服务器
    private selectServerLeastConnections(): ServerInstance | null {
        const healthyServers = this.getHealthyServers();

        if (healthyServers.length === 0) {
            return null;
        }

        return healthyServers.reduce((least, current) =>
            current.requestCount < least.requestCount ? current : least
        );
    }

    // 转发请求
    async forwardRequest(request: Request): Promise<Response> {
        const server = this.selectServerLeastConnections(); // 使用最少连接算法

        if (!server) {
            return new Response(JSON.stringify({
                error: "No healthy servers available",
                timestamp: new Date().toISOString()
            }), {
                status: 503,
                headers: { "Content-Type": "application/json" }
            });
        }

        try {
            server.requestCount++;
            server.lastUsed = Date.now();

            const url = new URL(request.url);
            const targetUrl = `${server.url}${url.pathname}${url.search}`;

            let requestBody: ReadableStream<Uint8Array> | null = null;

            // 安全地处理请求体
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                try {
                    // 克隆请求以避免body被消费的问题
                    const clonedRequest = request.clone();
                    requestBody = clonedRequest.body;
                } catch (bodyError) {
                    server.requestCount--;
                    console.error(`❌ Error reading request body for port ${server.port}:`, bodyError.message);

                    return new Response(JSON.stringify({
                        error: "Error reading request body",
                        message: bodyError.message,
                        server_port: server.port,
                        timestamp: new Date().toISOString()
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }
            }

            // 创建新的请求
            const forwardedRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: requestBody,
            });

            console.log(`🔄 Forwarding ${request.method} ${url.pathname} to port ${server.port}`);

            const response = await fetch(forwardedRequest, {
                signal: AbortSignal.timeout(30000) // 30秒超时
            });

            server.requestCount--;

            // 添加负载均衡器头信息
            const headers = new Headers(response.headers);
            headers.set('X-Load-Balancer', 'solana-swap-scan-lb');
            headers.set('X-Server-Port', server.port.toString());
            headers.set('X-Request-Count', server.requestCount.toString());

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers
            });

        } catch (error) {
            server.requestCount--;

            // 区分不同类型的错误，避免因为单个连接错误就标记服务器为不健康
            let shouldMarkUnhealthy = true;
            let statusCode = 502;
            let errorMessage = "Server error";

            if (error.name === 'AbortError') {
                statusCode = 504;
                errorMessage = "Request timeout";
                shouldMarkUnhealthy = false; // 超时不一定意味着服务器不健康
            } else if (error.message.includes("connection") || error.message.includes("ECONNREFUSED")) {
                statusCode = 503;
                errorMessage = "Connection refused";
                shouldMarkUnhealthy = true;
            } else if (error.message.includes("body") || error.message.includes("stream")) {
                statusCode = 400;
                errorMessage = "Request body error";
                shouldMarkUnhealthy = false; // 请求体错误不是服务器问题
            }

            if (shouldMarkUnhealthy) {
                server.isHealthy = false;
                console.error(`❌ Marking server port ${server.port} as unhealthy due to: ${error.message}`);
            } else {
                console.warn(`⚠️ Error forwarding to port ${server.port} (server still healthy): ${error.message}`);
            }

            return new Response(JSON.stringify({
                error: errorMessage,
                message: error.message,
                server_port: server.port,
                timestamp: new Date().toISOString()
            }), {
                status: statusCode,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // 获取状态信息
    getStatus() {
        const healthyCount = this.getHealthyServers().length;
        const totalRequests = this.servers.reduce((sum, server) => sum + server.requestCount, 0);

        return {
            totalServers: this.servers.length,
            healthyServers: healthyCount,
            unhealthyServers: this.servers.length - healthyCount,
            totalActiveRequests: totalRequests,
            servers: this.servers.map(server => ({
                port: server.port,
                isHealthy: server.isHealthy,
                requestCount: server.requestCount,
                lastUsed: server.lastUsed
            }))
        };
    }

    // 清理资源
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}

// 启动负载均衡器
// @ts-ignore: Deno is available in runtime
const port = parseInt(Deno.args[0] || "7999");
const lb = new LoadBalancer();

console.log(`🌐 Starting Load Balancer on port ${port}`);

// @ts-ignore: Deno is available in runtime
Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);

    // 状态端点
    if (url.pathname === "/lb-status") {
        return new Response(JSON.stringify(lb.getStatus(), null, 2), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 健康检查端点
    if (url.pathname === "/lb-health") {
        const status = lb.getStatus();
        return new Response(JSON.stringify({
            status: "healthy",
            load_balancer_port: port,
            healthy_servers: status.healthyServers,
            timestamp: new Date().toISOString()
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 转发其他所有请求
    return await lb.forwardRequest(req);
});

// 优雅关闭
// @ts-ignore: Deno is available in runtime
Deno.addSignalListener("SIGINT", () => {
    console.log("\n🛑 Shutting down Load Balancer...");
    lb.destroy();
    // @ts-ignore: Deno is available in runtime
    Deno.exit(0);
});

// @ts-ignore: Deno is available in runtime
Deno.addSignalListener("SIGTERM", () => {
    console.log("\n🛑 Shutting down Load Balancer...");
    lb.destroy();
    // @ts-ignore: Deno is available in runtime
    Deno.exit(0);
}); 