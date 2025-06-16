import { SolanaBlockUtil } from "../utils/SolanaBlockUtil.ts";
import redisClient from "../../config/redis.ts";
import {getBlockValue} from "../lib/utils.ts";
import {SolanaBlockDataHandler} from "../service/SolanaBlockDataHandler.ts";

const REDIS_KEY_LAST_BLOCK = "scanner:last_block";

export class SolanaBlockScanner {
    private isRunning = false;

    public async start(): Promise<void> {
        this.isRunning = true;

        while (this.isRunning) {
            try {
                // 获取最新高度
                const latestHeight = await SolanaBlockUtil.getLatestSlot();
                const cached = await redisClient.get(REDIS_KEY_LAST_BLOCK);
                let currentHeight = cached ? parseInt(cached) :0 // 初始从 latest - 10 开始
                if (currentHeight===0){
                    currentHeight=latestHeight;
                    await redisClient.set(REDIS_KEY_LAST_BLOCK, String(currentHeight+1));
                }
                while (currentHeight <= latestHeight-10) {
                    console.log(`⬇️ 正在获取区块 ${currentHeight} ...,latestHeight ${latestHeight}`);
                    let start= Date.now();
                    let blockData = await SolanaBlockUtil.getBlockData(currentHeight);
                    if (blockData.skip) {
                        // 跳过缺失高度
                        console.log(`跳过缺失高度 ${currentHeight}`);
                        await redisClient.set(REDIS_KEY_LAST_BLOCK, String(currentHeight+1));
                        currentHeight++;
                        continue;
                    }
                    if (!blockData.data) {
                        continue;
                    }
                    const data=blockData.data;
                    console.log(`fetch block ${currentHeight},transactions:${data.transactions.length},cost:${Date.now() - start} ms`);
                    SolanaBlockDataHandler.handleBlockData(data,currentHeight)
                    // 缓存最新处理高度
                    await redisClient.set(REDIS_KEY_LAST_BLOCK, String(currentHeight+1));
                    currentHeight++;
                }
                // 等待 1 秒后再查最新区块高度
                await this.delay(200);
            } catch (err) {
                console.error("❌ 区块扫描出错：", err);
                await this.delay(2000); // 错误时稍等重试
            }
        }
    }

    public stop() {
        this.isRunning = false;
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
const solanaBlockScanner = new SolanaBlockScanner();
solanaBlockScanner.start();
