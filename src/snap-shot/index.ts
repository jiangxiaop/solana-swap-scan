import { SNAP_SHOT_CONFIG } from "../constant/config.ts";
import { getLatestSnapshotByType, createSnapshot } from "../service/snapshot/snapshot.ts";
import { saveTokenSnapshots } from "../service/snapshot/token_ss.ts";
import { saveWalletTradingSnapshots } from "../service/snapshot/wallet_trading_ss.ts";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import { SnapShotType } from "../type/snapshot.ts";
import { TokenSwapFilterData } from "../type/swap.ts";
import { snapshotTokenValueByTxData } from "./token/index.ts";
import { snapshotWalletTradingByTxData } from "./wallet-trading/index.ts";
import redisClient from "../../config/redis.ts";

const filterSwapDataForTokenTrading = async (txData: TokenSwapFilterData[]) => {
    const tokenSnapShotData = snapshotTokenValueByTxData(txData);
    return tokenSnapShotData;
}

const filterSwapDataForWalletTrading = async (txData: TokenSwapFilterData[]) => {
    const walletSnapShotData = await snapshotWalletTradingByTxData(txData);
    return walletSnapShotData;
}

const getTokenAndWalletTradingDataForSnapShot = async (startTimestamp: number, endTimestamp: number, pageNum: number, pageSize: number) => {
    const txData = await SolanaBlockDataHandler.getXDaysDataByTimestamp(startTimestamp, endTimestamp, pageNum, pageSize);
    const filterData = SolanaBlockDataHandler.filterTokenData(txData);

    const tokenSnapShotData = await filterSwapDataForTokenTrading(filterData);
    const walletSnapShotData = await filterSwapDataForWalletTrading(filterData);

    return {
        tokenSnapShotData,
        walletSnapShotData
    }
}

/**
 * Redis 锁管理类
 */
class SnapshotLock {
    private static readonly LOCK_KEY = "snapshot:lock";
    private static readonly LOCK_TIMEOUT = 60 * 1000; // 60秒超时
    private static readonly LOCK_VALUE = `snapshot_${Date.now()}_${Math.random()}`;

    /**
     * 获取锁
     */
    static async acquireLock(): Promise<boolean> {
        try {
            const result = await (redisClient as any).set(
                this.LOCK_KEY,
                this.LOCK_VALUE,
                "PX",
                this.LOCK_TIMEOUT,
                "NX"
            );
            return result === "OK";
        } catch (error) {
            console.error("Error acquiring snapshot lock:", error);
            return false;
        }
    }

    /**
     * 释放锁
     */
    static async releaseLock(): Promise<boolean> {
        try {
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;
            const result = await (redisClient as any).eval(luaScript, 1, this.LOCK_KEY, this.LOCK_VALUE);
            return result === 1;
        } catch (error) {
            console.error("Error releasing snapshot lock:", error);
            return false;
        }
    }

    /**
     * 检查锁是否存在
     */
    static async isLocked(): Promise<boolean> {
        try {
            const value = await (redisClient as any).get(this.LOCK_KEY);
            return value !== null;
        } catch (error) {
            console.error("Error checking snapshot lock:", error);
            return false;
        }
    }
}

/**
 * 生成时间窗口列表
 */
function generateTimeWindows(startTimestamp: number, endTimestamp: number, windowSize: number): Array<{ start: number, end: number }> {
    const windows: Array<{ start: number, end: number }> = [];
    let current = startTimestamp;

    while (current < endTimestamp) {
        const windowEnd = Math.min(current + windowSize, endTimestamp);
        windows.push({
            start: current,
            end: windowEnd
        });
        current = windowEnd;
    }

    return windows;
}

/**
 * 检查当前时间是否在快照窗口的结束节点
 */
function isAtWindowEndpoint(currentTime: number, windowSize: number): boolean {
    // 检查当前时间是否接近窗口结束点（允许1秒误差）- 现在是秒级时间戳
    const timeInWindow = currentTime % windowSize;
    return timeInWindow <= 1 || timeInWindow >= (windowSize - 1);
}

/**
 * 获取指定时间后的第一条数据的时间戳
 */
async function getFirstDataTimestamp(afterTimestamp: number): Promise<number | null> {
    try {
        // 先尝试获取一小批数据来确定实际的起始时间
        const sampleData = await SolanaBlockDataHandler.getXDaysDataByTimestamp(
            afterTimestamp,
            Math.floor(Date.now() / 1000), // 当前时间改为秒级
            1,
            100
        );


        console.log("sampleData", afterTimestamp, Math.floor(Date.now() / 1000), sampleData);

        if (sampleData.length === 0) {
            return null;
        }

        // 找到最早的数据时间 - 确保转换为秒级
        const earliestTime = Math.min(
            ...sampleData.map(item => parseInt(item.transaction_time)) // transaction_time 已经是秒级，不需要 * 1000
        );

        console.log("earliestTime", earliestTime);


        return earliestTime;
    } catch (error) {
        console.error("Error getting first data timestamp:", error);
        return null;
    }
}

/**
 * 主快照函数 - 按时间窗口分段处理
 */
const SnapshotForTokenAndWalletTrading = async (): Promise<{
    tokenSnapShot: boolean;
    walletSnapShot: boolean;
    processedWindows: number;
    message: string;
}> => {
    // 检查是否已有锁
    // if (await SnapshotLock.isLocked()) {
    //     console.log("Snapshot process is already running, skipping...");
    //     return {
    //         tokenSnapShot: false,
    //         walletSnapShot: false,
    //         processedWindows: 0,
    //         message: "Snapshot process is already running"
    //     };
    // }

    // // 获取锁
    // const lockAcquired = await SnapshotLock.acquireLock();
    // if (!lockAcquired) {
    //     console.log("Failed to acquire snapshot lock");
    //     return {
    //         tokenSnapShot: false,
    //         walletSnapShot: false,
    //         processedWindows: 0,
    //         message: "Failed to acquire snapshot lock"
    //     };
    // }

    try {
        const SNAPSHOT_TIME_WINDOW = SNAP_SHOT_CONFIG.SNAPSHOT_TIME_WINDOW; // 假设配置是秒级
        const currentTime = Math.floor(Date.now() / 1000); // 改为秒级时间戳

        // 获取最后的快照时间
        const LAST_SNAPSHOT_TIME_FOR_TOKEN = (await getLatestSnapshotByType(SnapShotType.TokenNormSnapShot))?.timestamp || 0;
        const LAST_SNAPSHOT_TIME_FOR_WALLET = (await getLatestSnapshotByType(SnapShotType.SnapShotForWalletTrading))?.timestamp || 0;

        // 取最早的时间作为查询起始点
        let queryStartTimestamp = Math.min(LAST_SNAPSHOT_TIME_FOR_TOKEN, LAST_SNAPSHOT_TIME_FOR_WALLET);

        // 处理首次运行的情况（没有任何快照记录）
        if (queryStartTimestamp === 0) {
            // 首次运行时，从最开始进行查询
            queryStartTimestamp = 0;
            console.log("First time running snapshot, querying from 0");
        }

        console.log(`Query start timestamp: ${queryStartTimestamp} (${new Date(queryStartTimestamp * 1000).toISOString()})`);
        console.log(`Current timestamp: ${currentTime} (${new Date(currentTime * 1000).toISOString()})`);

        // 🔥 新逻辑：先获取实际有数据的起始时间
        console.log("📊 获取实际数据的起始时间...");
        const actualStartTimestamp = await getFirstDataTimestamp(queryStartTimestamp);

        if (actualStartTimestamp === null) {
            console.log("No data found in the specified time range");
            return {
                tokenSnapShot: false,
                walletSnapShot: false,
                processedWindows: 0,
                message: "No data found in the specified time range"
            };
        }

        console.log(`Actual data start timestamp: ${actualStartTimestamp} (${new Date(actualStartTimestamp * 1000).toISOString()})`);
        console.log(`Time window size: ${SNAPSHOT_TIME_WINDOW} seconds`);

        // 检查当前时间是否在窗口结束节点
        // if (!isAtWindowEndpoint(currentTime, SNAPSHOT_TIME_WINDOW)) {
        //     console.log("Current time is not at window endpoint, waiting for next snapshot window...");
        //     return {
        //         tokenSnapShot: false,
        //         walletSnapShot: false,
        //         processedWindows: 0,
        //         message: "Waiting for next snapshot window"
        //     };
        // }

        // 基于实际起始时间生成时间窗口列表
        const timeWindows = generateTimeWindows(actualStartTimestamp, currentTime, SNAPSHOT_TIME_WINDOW);


        if (timeWindows.length === 0) {
            console.log("No time windows to process");
            return {
                tokenSnapShot: false,
                walletSnapShot: false,
                processedWindows: 0,
                message: "No time windows to process"
            };
        }

        console.log(`Generated ${timeWindows.length} time windows for processing based on actual data`);

        // 🔥 新策略：边处理边写库，确保每个时间窗口都能基于前面的数据进行计算
        let processedWindows = 0;
        let totalTokenSnapshots = 0;
        let totalWalletSnapshots = 0;

        // 逐个处理时间窗口，每个窗口处理完立即写库
        for (let i = 0; i < timeWindows.length; i++) {
            const window = timeWindows[i];
            console.log(`Processing window ${i + 1}/${timeWindows.length}: ${new Date(window.start).toISOString()} -> ${new Date(window.end).toISOString()}`);

            let pageNum = 1;
            const pageSize = 3000;
            const windowTokenSnapshots: any[] = [];
            const windowWalletSnapshots: any[] = [];

            // 分页收集该时间窗口的所有数据
            console.log(`  📊 Collecting data for window ${i + 1}...`);
            while (true) {
                const { tokenSnapShotData, walletSnapShotData } = await getTokenAndWalletTradingDataForSnapShot(
                    window.start,
                    window.end,
                    pageNum,
                    pageSize
                );

                // 如果没有数据了，跳出循环
                if (tokenSnapShotData.length === 0 && walletSnapShotData.length === 0) {
                    break;
                }

                // 将数据添加到当前窗口的数组中
                if (tokenSnapShotData.length > 0) {
                    windowTokenSnapshots.push(...tokenSnapShotData);
                }



                if (walletSnapShotData.length > 0) {

                    console.log("walletSnapShotData is greater than 0", walletSnapShotData.length);

                    windowWalletSnapshots.push(...walletSnapShotData);
                }

                pageNum++;

                // 如果数据量小于页面大小，说明已经是最后一页
                if (tokenSnapShotData.length < pageSize && walletSnapShotData.length < pageSize) {
                    break;
                }
            }

            console.log(`  📦 Window ${i + 1} data collected: ${windowTokenSnapshots.length} token snapshots, ${windowWalletSnapshots.length} wallet snapshots`);

            // 🔥 立即处理并保存当前窗口的数据
            let windowTokenSnapshotsSaved = 0;
            let windowWalletSnapshotsSaved = 0;

            console.log(`  💾 Saving window ${i + 1} data to database...`);

            // 保存Token快照数据
            if (windowTokenSnapshots.length > 0) {
                const tokenSuccess = await saveTokenSnapshots(windowTokenSnapshots);
                if (tokenSuccess) {
                    windowTokenSnapshotsSaved = windowTokenSnapshots.length;
                    totalTokenSnapshots += windowTokenSnapshotsSaved;

                    // 记录Token快照的时间节点到数据库
                    await createSnapshot({
                        timestamp: window.end, // window.end 现在是秒级时间戳
                        type: SnapShotType.TokenNormSnapShot,
                        blockHeight: 0, // 这里可以根据需要设置实际的区块高度
                        blockTime: window.end // 使用秒级时间戳
                    });

                    console.log(`  ✅ Token snapshots saved: ${windowTokenSnapshotsSaved}`);
                }
            }

            // 保存Wallet快照数据
            if (windowWalletSnapshots.length > 0) {
                const walletSuccess = await saveWalletTradingSnapshots(windowWalletSnapshots);
                if (walletSuccess) {
                    windowWalletSnapshotsSaved = windowWalletSnapshots.length;
                    totalWalletSnapshots += windowWalletSnapshotsSaved;

                    // 记录Wallet快照的时间节点到数据库
                    await createSnapshot({
                        timestamp: window.end, // window.end 现在是秒级时间戳
                        type: SnapShotType.SnapShotForWalletTrading,
                        blockHeight: 0, // 这里可以根据需要设置实际的区块高度
                        blockTime: window.end // 使用秒级时间戳
                    });

                    console.log(`  ✅ Wallet snapshots saved: ${windowWalletSnapshotsSaved}`);
                }
            }

            processedWindows++;
            console.log(`✨ Window ${i + 1}/${timeWindows.length} completed: Token: ${windowTokenSnapshotsSaved}, Wallet: ${windowWalletSnapshotsSaved}`);
            console.log(`📈 Progress: ${processedWindows}/${timeWindows.length} windows processed\n`);
        }

        console.log(`🎉 Snapshot completed successfully!`);
        console.log(`📊 Final Results:`);
        console.log(`   - Processed windows: ${processedWindows}/${timeWindows.length}`);
        console.log(`   - Total Token snapshots: ${totalTokenSnapshots}`);
        console.log(`   - Total Wallet snapshots: ${totalWalletSnapshots}`);

        return {
            tokenSnapShot: totalTokenSnapshots > 0,
            walletSnapShot: totalWalletSnapshots > 0,
            processedWindows,
            message: `Successfully processed ${processedWindows} time windows with ${totalTokenSnapshots} token snapshots and ${totalWalletSnapshots} wallet snapshots`
        };

    } catch (error) {
        console.error("Error in snapshot process:", error);
        return {
            tokenSnapShot: false,
            walletSnapShot: false,
            processedWindows: 0,
            message: `Snapshot failed: ${error instanceof Error ? error.message : String(error)}`
        };
    } finally {
        // 确保释放锁
        // const lockReleased = await SnapshotLock.releaseLock();
        // if (!lockReleased) {
        //     console.warn("Failed to release snapshot lock");
        // } else {
        //     console.log("Snapshot lock released successfully");
        // }
    }
}

export { SnapshotForTokenAndWalletTrading };