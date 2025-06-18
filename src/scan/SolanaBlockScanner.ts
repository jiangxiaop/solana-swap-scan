// src/scan/SolanaBlockScanner.ts
import { SolanaBlockUtil } from "../utils/SolanaBlockUtil.ts";
import redisClient from "../../config/redis.ts";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import {SolanaConnectionPool} from "../utils/SolanaConnectionPool.ts";

const REDIS_KEY_LAST_BLOCK = "scanner:last_block";
const REDIS_FAILED_SLOTS = "scanner:failed_slots";

export class SolanaBlockScanner {
    private isRunning = false;
    private readonly batchSize = SolanaConnectionPool.getPoolSize();

    public async start(): Promise<void> {
        this.isRunning = true;

        while (this.isRunning) {
            try {
                let startTime = Date.now();
                const latestHeight = await SolanaBlockUtil.getLatestSlot();
                let cached = await redisClient.get(REDIS_KEY_LAST_BLOCK);
                let currentHeight = cached ? parseInt(cached) : 0;
                if (currentHeight === 0) {
                    currentHeight = latestHeight;
                    await redisClient.set(REDIS_KEY_LAST_BLOCK, String(currentHeight));
                }

                const maxAvailableSlot = latestHeight - 10;

                const slots = Array.from({ length: this.batchSize }, (_, i) => currentHeight + i)
                    .filter(slot => slot <= maxAvailableSlot);

                if (slots.length === 0) {
                    continue;
                }

                const results = await Promise.allSettled(
                    slots.map((slot,index) => this.processSlot(slot,index))
                );

                const failedSlots: number[] = [];
                let successCount = 0;

                for (let i = 0; i < results.length; i++) {
                    const result = results[i];
                    const slot = slots[i];

                    if (result.status === "fulfilled") {
                        successCount++;
                    } else {
                        failedSlots.push(slot);
                    }
                }

                if (successCount > 0) {
                    await redisClient.set(REDIS_KEY_LAST_BLOCK, String(currentHeight + this.batchSize));
                }

                if (failedSlots.length > 0) {
                    await redisClient.sadd(REDIS_FAILED_SLOTS, ...failedSlots.map(String));
                }
                console.log(`processed ${slots.length} slots, success: ${successCount}, failed: ${failedSlots.length}, batch process time:`, Date.now() - startTime);
                await this.delay(200);
            } catch (err) {
                console.error("❌ 区块扫描出错：", err);
                await this.delay(2000);
            }
        }
    }

    private async processSlot(slot: number,index:number): Promise<void> {
        const start=Date.now();
        const blockData = await SolanaBlockUtil.getBlockData(slot,index);
        if (blockData.skip) {
            return;
        }
        if (!blockData.data) {
            throw new Error(`Block ${slot} unavailable`);
        }
        console.log(`fetch block data ${slot},cost:${Date.now() - start} ms`);
        await SolanaBlockDataHandler.handleBlockData(blockData.data, slot);
    }

    public stop() {
        this.isRunning = false;
    }

    private async delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

const scanner = new SolanaBlockScanner();
scanner.start();
