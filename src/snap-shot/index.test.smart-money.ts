#!/usr/bin/env -S deno test --allow-all

import { assert } from "https://deno.land/std/assert/mod.ts";
import { stub, restore } from "https://deno.land/std/testing/mock.ts";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import { SwapTransactionToken } from "../type/swap.ts";
import { loadEnv } from "../../test/mock.ts";
import client from "../../config/db.ts";
import { SnapShotForWalletTrading } from "../type/transaction.ts";
import { TokenNormSnapShot } from "../type/transaction.ts";

// Mock数据写入文件的函数
const MOCK_DATA_DIR = "./test_data_for_smart_money";

// 全局变量来控制是否使用Mock模式
let MOCK_MODE = false;
let mockTokenSnapshots: TokenNormSnapShot[] = [];
let mockWalletSnapshots: SnapShotForWalletTrading[] = [];

/**
 * Mock Token快照保存函数 - 写入JSON文件
 */
async function mockSaveTokenSnapshots(snapshots: TokenNormSnapShot[]): Promise<boolean> {
    try {
        // 确保目录存在
        await Deno.mkdir(MOCK_DATA_DIR, { recursive: true });

        const filename = `${MOCK_DATA_DIR}/token_snapshots.json`;

        const dataToSave = {
            type: "token_snapshots",
            timestamp: new Date().toISOString(),
            count: snapshots.length,
            data: snapshots
        };

        await Deno.writeTextFile(filename, JSON.stringify(dataToSave, null, 2));
        console.log(`✅ Mock保存了 ${snapshots.length} 个Token快照到文件: ${filename}`);

        // 保存到全局变量供后续使用
        mockTokenSnapshots = [...mockTokenSnapshots, ...snapshots];

        return true;
    } catch (error) {
        console.error("Mock保存Token快照失败:", error);
        return false;
    }
}

/**
 * Mock 钱包交易快照保存函数 - 写入JSON文件
 */
async function mockSaveWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<boolean> {
    try {
        // 确保目录存在
        await Deno.mkdir(MOCK_DATA_DIR, { recursive: true });

        const filename = `${MOCK_DATA_DIR}/wallet_trading_snapshots.json`;

        const dataToSave = {
            type: "wallet_trading_snapshots",
            timestamp: new Date().toISOString(),
            count: snapshots.length,
            data: snapshots,
            // 额外统计信息，便于分析
            statistics: {
                uniqueWallets: [...new Set(snapshots.map(s => s.walletAddress))].length,
                totalTokens: snapshots.reduce((sum, s) => sum + s.currentTokenValue.length, 0),
                uniqueTokens: [...new Set(snapshots.flatMap(s => s.currentTokenValue.map(t => t.tokenAddress)))].length,
                totalBuyTransactions: snapshots.reduce((sum, s) => sum + s.buy_count, 0),
                totalSellTransactions: snapshots.reduce((sum, s) => sum + s.sell_count, 0)
            }
        };

        await Deno.writeTextFile(filename, JSON.stringify(dataToSave, null, 2));
        console.log(`✅ Mock保存了 ${snapshots.length} 个钱包交易快照到文件: ${filename}`);
        console.log(`📊 统计: ${dataToSave.statistics.uniqueWallets} 个钱包, ${dataToSave.statistics.uniqueTokens} 个代币`);

        // 保存到全局变量供后续使用
        mockWalletSnapshots = [...mockWalletSnapshots, ...snapshots];

        return true;
    } catch (error) {
        console.error("Mock保存钱包交易快照失败:", error);
        return false;
    }
}

/**
 * Mock 快照节点记录函数 - 写入JSON文件
 */
async function mockCreateSnapshot(snapshotInfo: any): Promise<any> {
    try {
        const filename = `${MOCK_DATA_DIR}/snapshot_nodes.json`;

        const existingData = await Deno.readTextFile(filename).catch(() => '{"snapshots": []}');
        const data = JSON.parse(existingData);

        data.snapshots.push({
            ...snapshotInfo,
            savedAt: new Date().toISOString()
        });

        await Deno.writeTextFile(filename, JSON.stringify(data, null, 2));
        console.log(`📝 Mock记录快照节点: ${snapshotInfo.type} at block ${snapshotInfo.blockHeight}`);

        return { id: data.snapshots.length };
    } catch (error) {
        console.error("Mock记录快照节点失败:", error);
        return null;
    }
}

/**
 * 加载测试数据
 */
async function loadTestData(): Promise<SwapTransactionToken[]> {
    try {
        const testDataFile = "./txdata.json";
        const data = await Deno.readTextFile(testDataFile);
        return JSON.parse(data);
    } catch (error) {
        console.error("加载测试数据失败:", error);
        return [];
    }
}

/**
 * Mock SolanaBlockDataHandler.getDataByBlockHeightRange
 */
async function mockGetDataByBlockHeightRange(
    startBlockHeight: number,
    endBlockHeight: number,
    pageNum: number = 1,
    pageSize: number = 10000
): Promise<SwapTransactionToken[]> {
    const testData = await loadTestData();

    // 根据区块高度范围过滤数据
    const filteredData = testData.filter(item => {
        const blockHeight = item.block_height;
        return blockHeight >= startBlockHeight && blockHeight <= endBlockHeight;
    });

    // 分页处理
    const start = (pageNum - 1) * pageSize;
    const end = start + pageSize;
    const pageData = filteredData.slice(start, end);

    console.log(`Mock返回区块 ${startBlockHeight}-${endBlockHeight} 的第 ${pageNum} 页数据: ${pageData.length} 条`);

    return pageData;
}

/**
 * 自定义快照处理函数 - 直接处理数据而不调用数据库
 */
async function customSnapshotProcessing(startBlockHeight: number, endBlockHeight: number) {
    console.log(`🚀 开始自定义快照处理: 区块 ${startBlockHeight} - ${endBlockHeight}`);

    // 设置Mock模式
    MOCK_MODE = true;

    // 清空之前的mock数据
    mockTokenSnapshots = [];
    mockWalletSnapshots = [];

    try {
        // 获取测试数据
        const testData = await loadTestData();

        // 过滤指定区块范围的数据
        const filteredData = testData.filter(item => {
            return item.block_height >= startBlockHeight && item.block_height <= endBlockHeight;
        });

        console.log(`📊 找到 ${filteredData.length} 条符合区块范围的交易数据`);

        if (filteredData.length === 0) {
            return {
                tokenSnapShot: false,
                walletSnapShot: false,
                processedWindows: 0,
                message: "没有找到符合条件的数据"
            };
        }

        // 导入快照处理模块
        const { snapshotWalletTradingByTxDataOptimized } = await import("./wallet-trading/index.ts");
        const { snapshotTokenValueByTxData } = await import("./token/index.ts");

        // 处理钱包快照
        let walletSnapshots: SnapShotForWalletTrading[] = [];
        let tokenSnapshots: TokenNormSnapShot[] = [];

        try {
            console.log("🏦 开始处理钱包快照...");
            // 需要将SwapTransactionToken[]转换为TokenSwapFilterData[]
            const filteredWalletData = SolanaBlockDataHandler.filterTokenData(filteredData);
            walletSnapshots = await snapshotWalletTradingByTxDataOptimized(filteredWalletData);
            console.log(`✅ 生成了 ${walletSnapshots.length} 个钱包快照`);
        } catch (error) {
            console.error("钱包快照处理失败:", error);
        }

        try {
            console.log("🪙 开始处理代币快照...");
            // 需要将SwapTransactionToken[]转换为TokenSwapFilterData[]
            const filteredTokenData = SolanaBlockDataHandler.filterTokenData(filteredData);
            tokenSnapshots = snapshotTokenValueByTxData(filteredTokenData);
            console.log(`✅ 生成了 ${tokenSnapshots.length} 个代币快照`);
        } catch (error) {
            console.error("代币快照处理失败:", error);
        }

        // 保存快照数据到文件
        let tokenSaved = false;
        let walletSaved = false;

        if (tokenSnapshots.length > 0) {
            tokenSaved = await mockSaveTokenSnapshots(tokenSnapshots);
        }

        if (walletSnapshots.length > 0) {
            walletSaved = await mockSaveWalletTradingSnapshots(walletSnapshots);
        }

        // 保存快照节点记录
        if (tokenSaved) {
            await mockCreateSnapshot({
                timestamp: Math.floor(Date.now() / 1000),
                type: "TokenNormSnapShot",
                blockHeight: endBlockHeight,
                blockTime: Math.floor(Date.now() / 1000)
            });
        }

        if (walletSaved) {
            await mockCreateSnapshot({
                timestamp: Math.floor(Date.now() / 1000),
                type: "SnapShotForWalletTrading",
                blockHeight: endBlockHeight,
                blockTime: Math.floor(Date.now() / 1000)
            });
        }

        return {
            tokenSnapShot: tokenSaved,
            walletSnapShot: walletSaved,
            processedWindows: 1,
            message: `成功处理了区块 ${startBlockHeight}-${endBlockHeight}，生成了 ${tokenSnapshots.length} 个代币快照和 ${walletSnapshots.length} 个钱包快照`
        };

    } catch (error) {
        console.error("自定义快照处理失败:", error);
        throw error;
    } finally {
        MOCK_MODE = false;
    }
}

let testData: SwapTransactionToken[] = [];

/**
 * 快照系统完整流程测试 - Mock版本用于聪明钱算法测试
 */
Deno.test("快照系统完整流程测试 - Mock写入文件生成聪明钱测试数据", async () => {
    testData = await loadTestData();
    await loadEnv();

    console.log(`📊 加载了 ${testData.length} 条测试数据`);

    try {
        // 清理之前的测试数据
        try {
            await Deno.remove(MOCK_DATA_DIR, { recursive: true });
            console.log("🧹 清理了之前的测试数据目录");
        } catch {
            // 目录不存在，忽略错误
        }

        console.log("🚀 开始执行基于区块高度的快照测试(Mock版本)...");

        // 定义测试的区块高度范围 - 使用较小范围以便快速测试
        const startBlockHeight = 347649500;
        const endBlockHeight = 347649520; // 更小的范围

        // 使用自定义快照处理函数
        const result = await customSnapshotProcessing(startBlockHeight, endBlockHeight);

        console.log("📋 快照执行结果:", result);

        // 统计测试数据
        const tokenCount: string[] = [];
        testData.forEach((item) => {
            if (!tokenCount.includes(item.token_address)) {
                tokenCount.push(item.token_address);
            }
        });

        const walletCount = [...new Set(testData.map((item) => item.wallet_address))];

        console.log(`🔢 统计了 ${tokenCount.length} 个token和 ${walletCount.length} 个钱包`);

        // 验证基本返回结果
        assert(typeof result === "object", "返回结果应该是对象");
        assert(typeof result.tokenSnapShot === "boolean", "tokenSnapShot 应该是布尔值");
        assert(typeof result.walletSnapShot === "boolean", "walletSnapShot 应该是布尔值");
        assert(typeof result.processedWindows === "number", "processedWindows 应该是数字");
        assert(typeof result.message === "string", "message 应该是字符串");

        console.log(`✅ 测试完成 - 处理了 ${result.processedWindows} 个区块窗口`);
        console.log(`📝 消息: ${result.message}`);

        // 检查生成的文件
        console.log("\n📁 检查生成的测试数据文件:");
        try {
            for await (const dirEntry of Deno.readDir(MOCK_DATA_DIR)) {
                if (dirEntry.isFile && dirEntry.name.endsWith('.json')) {
                    const filePath = `${MOCK_DATA_DIR}/${dirEntry.name}`;
                    const fileInfo = await Deno.stat(filePath);
                    console.log(`  📄 ${dirEntry.name} (${(fileInfo.size / 1024).toFixed(2)} KB)`);

                    // 如果是钱包快照文件，显示一些统计信息
                    if (dirEntry.name.includes('wallet_trading_snapshots')) {
                        const content = await Deno.readTextFile(filePath);
                        const data = JSON.parse(content);
                        console.log(`    📊 包含 ${data.count} 个钱包快照`);
                        console.log(`    🏦 ${data.statistics.uniqueWallets} 个唯一钱包`);
                        console.log(`    🪙 ${data.statistics.uniqueTokens} 个唯一代币`);
                        console.log(`    📈 ${data.statistics.totalBuyTransactions} 次买入, ${data.statistics.totalSellTransactions} 次卖出`);
                    }
                }
            }
        } catch (error) {
            console.warn("无法读取生成的文件:", error);
        }

        console.log(`\n🎯 聪明钱算法测试数据已生成在目录: ${MOCK_DATA_DIR}`);
        console.log("📝 可以使用这些文件测试聪明钱分析算法:");
        console.log("   1. wallet_trading_snapshots_*.json - 钱包交易快照数据");
        console.log("   2. token_snapshots_*.json - 代币快照数据");
        console.log("   3. snapshot_nodes_*.json - 快照节点记录");

    } finally {
        await client.close();
        restore();
    }
});

/**
 * 辅助函数：从生成的文件加载钱包快照数据用于聪明钱分析
 */
export async function loadWalletSnapshotsForSmartMoneyAnalysis(): Promise<SnapShotForWalletTrading[]> {
    try {
        const files: string[] = [];

        // 优先收集大量数据文件
        for await (const dirEntry of Deno.readDir(MOCK_DATA_DIR)) {
            if (dirEntry.isFile && dirEntry.name.includes('large_wallet_trading_snapshots') && dirEntry.name.endsWith('.json')) {
                files.push(`${MOCK_DATA_DIR}/${dirEntry.name}`);
            }
        }

        // 如果没有大量数据文件，收集原有的钱包快照文件
        if (files.length === 0) {
            for await (const dirEntry of Deno.readDir(MOCK_DATA_DIR)) {
                if (dirEntry.isFile && dirEntry.name.includes('wallet_trading_snapshots') && dirEntry.name.endsWith('.json')) {
                    console.log(123123123);

                    files.push(`${MOCK_DATA_DIR}/${dirEntry.name}`);
                }
            }
        }

        let allSnapshots: SnapShotForWalletTrading[] = [];

        // 合并所有文件的数据
        for (const file of files) {
            const content = await Deno.readTextFile(file);
            const data = JSON.parse(content);
            allSnapshots = [...allSnapshots, ...data.data];
        }

        console.log(`📚 从 ${files.length} 个文件加载了 ${allSnapshots.length} 个钱包快照用于聪明钱分析`);

        return allSnapshots;
    } catch (error) {
        console.error("加载钱包快照数据失败:", error);
        return [];
    }
}

/**
 * 辅助函数：从快照数据中提取唯一的钱包地址列表
 */
export function extractWalletAddressesFromSnapshots(snapshots: SnapShotForWalletTrading[]): string[] {
    const uniqueWallets = [...new Set(snapshots.map(s => s.walletAddress))];
    console.log(`📍 提取了 ${uniqueWallets.length} 个唯一钱包地址`);
    return uniqueWallets;
}

/**
 * 辅助函数：清理测试数据
 */
export async function cleanupTestData(): Promise<void> {
    try {
        await Deno.remove(MOCK_DATA_DIR, { recursive: true });
        console.log("🧹 清理了聪明钱测试数据目录");
    } catch (error) {
        console.warn("清理测试数据失败:", error);
    }
} 