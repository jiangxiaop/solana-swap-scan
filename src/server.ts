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

            try {
                const text = await req.text();
                const body = JSON.parse(text);

                const data: {
                    blocknum: number,
                    blockdata: VersionedBlockResponse
                }[] = body

                const start = Date.now();

                console.log(data.length);


                await SolanaBlockDataHandler.handleMultiBlockData(data);

                console.log(`[Port ${port}] server total use, cost: ${Date.now() - start} ms`);

                // 打印当前端口内存占用情况
                // @ts-ignore: Deno is available in runtime
                const memoryUsage = Deno.memoryUsage();
                console.log(`[Port ${port}] 内存占用情况:`, {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
                });

                if (global.gc) {
                    global.gc();
                }

                return new Response(JSON.stringify({
                    success: true,
                    port,
                    processedBlocks: data.length,
                    processingTime: Date.now() - start,
                    data: {}
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