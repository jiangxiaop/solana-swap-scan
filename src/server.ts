import { VersionedBlockResponse } from "@solana/web3.js";
import { SolanaBlockDataHandler } from "./service/SolanaBlockDataHandler.ts";

// 从命令行参数或环境变量获取端口，默认为8000
// @ts-ignore: Deno is available in runtime
const port = parseInt(Deno.args[0] || Deno.env.get("PORT") || "8000");

console.log(`🚀 Starting server on port ${port}`);

// @ts-ignore: Deno is available in runtime
Deno.serve({ port }, async (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/api/parse-blockdata") {
        if (req.method === "POST") {
            let body;
            
            try {
                // 检查Content-Type
                const contentType = req.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: "Content-Type must be application/json",
                        port
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 检查Content-Length，避免过大的请求
                const contentLength = req.headers.get("content-length");
                if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) { // 100MB限制
                    return new Response(JSON.stringify({
                        success: false,
                        error: "Request body too large (max 100MB)",
                        port
                    }), {
                        status: 413,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 添加超时控制的body读取
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

                try {
                    const text = await req.text();
                    clearTimeout(timeoutId);
                    
                    if (!text || text.trim() === '') {
                        return new Response(JSON.stringify({
                            success: false,
                            error: "Request body is empty",
                            port
                        }), {
                            status: 400,
                            headers: { "Content-Type": "application/json" }
                        });
                    }

                    body = JSON.parse(text);
                } catch (parseError) {
                    clearTimeout(timeoutId);
                    if (parseError.name === 'AbortError') {
                        console.log(`[Port ${port}] Request timeout while reading body`);
                        return new Response(JSON.stringify({
                            success: false,
                            error: "Request timeout",
                            port
                        }), {
                            status: 408,
                            headers: { "Content-Type": "application/json" }
                        });
                    }
                    
                    console.log(`[Port ${port}] JSON parse error:`, parseError.message);
                    return new Response(JSON.stringify({
                        success: false,
                        error: "Invalid JSON format",
                        port,
                        details: parseError.message
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 验证数据格式
                if (!Array.isArray(body)) {
                    return new Response(JSON.stringify({
                        success: false,
                        error: "Request body must be an array",
                        port
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                const data: {
                    blocknum: number,
                    blockdata: VersionedBlockResponse
                }[] = body

                const start = Date.now();

                const parseResult = await SolanaBlockDataHandler.handleMultiBlockData(data);

                console.log(`[Port ${port}] server total use, cost: ${Date.now() - start} ms`);

                return new Response(JSON.stringify({
                    success: true,
                    port,
                    processedBlocks: data.length,
                    processingTime: Date.now() - start,
                    data: parseResult
                }), {
                    headers: { "Content-Type": "application/json" }
                });

            } catch (error) {
                console.log(`[Port ${port}] Error processing request:`, error.message);
                
                // 区分不同类型的错误
                let statusCode = 500;
                let errorMessage = error.message;
                
                if (error.name === 'AbortError') {
                    statusCode = 408;
                    errorMessage = "Request timeout";
                } else if (error.message.includes("connection")) {
                    statusCode = 400;
                    errorMessage = "Connection error while reading request";
                } else if (error.message.includes("JSON")) {
                    statusCode = 400;
                    errorMessage = "Invalid JSON format";
                }
                
                return new Response(JSON.stringify({
                    success: false,
                    error: errorMessage,
                    port,
                    timestamp: new Date().toISOString()
                }), {
                    status: statusCode,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        return new Response("pong", {
            headers: { "Content-Type": "text/plain" }
        });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
        return new Response(JSON.stringify({
            status: "healthy",
            port,
            timestamp: new Date().toISOString()
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // Return 404 for other paths
    return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
    });
});