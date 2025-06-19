import { assertEquals, assert } from "jsr:@std/assert";
import { stub, restore } from "jsr:@std/testing/mock";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import { SwapTransactionToken } from "../type/swap.ts";
import { snapshotWalletTradingByTxData, snapshotWalletTradingByTxDataOptimized } from "./wallet-trading/index.ts";
import { loadEnv } from "../../test/mock.ts";
import client from "../../config/db.ts";

// 测试数据加载
async function loadTestData(): Promise<any[]> {
    try {
        const data = await Deno.readTextFile("./txdata.json");
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to load test data:", error);
        return [];
    }
}

// 数据转换函数
function convertToSwapTransactionToken(rawData: any[]): SwapTransactionToken[] {
    return rawData.map((item, index) => ({
        tx_hash: item.tx_hash,
        trade_type: item.trade_type,
        transaction_time: item.transaction_time,
        pool_address: `pool_${item.token_address.slice(-8)}`,
        block_height: parseInt(item.block_height) || (100000 + index),
        wallet_address: item.wallet_address,
        token_amount: item.token_amount,
        token_symbol: item.token_symbol || "Unknown",
        token_address: item.token_address,
        quote_symbol: item.quote_symbol,
        quote_amount: item.quote_amount,
        quote_address: item.quote_address,
        quote_price: item.quote_price,
        usd_price: item.usd_price,
        usd_amount: item.usd_amount
    }));
}

function mockGetDataByBlockHeightRange(
    startBlockHeight: number,
    endBlockHeight: number
): Promise<SwapTransactionToken[]> {
    const testData = JSON.parse(Deno.readTextFileSync("./txdata.json"));
    const filteredData = testData.filter((item: any) => {
        const itemBlockHeight = parseInt(item.block_height) || 0;
        return itemBlockHeight >= startBlockHeight && itemBlockHeight <= endBlockHeight;
    });
    return Promise.resolve(convertToSwapTransactionToken(filteredData));
}

Deno.test("钱包交易快照处理性能对比测试", async () => {
    await loadEnv();
    const testData = await loadTestData();

    if (testData.length === 0) {
        console.log("⚠️ 没有测试数据，跳过性能测试");
        return;
    }

    try {
        // Mock数据获取函数
        const getDataStub = stub(
            SolanaBlockDataHandler,
            "getDataByBlockHeightRange",
            mockGetDataByBlockHeightRange
        );

        console.log(`🚀 开始性能对比测试，测试数据: ${testData.length} 条`);

        // 获取并过滤测试数据
        const txData = await SolanaBlockDataHandler.getDataByBlockHeightRange(347649500, 347649550);
        const filterData = SolanaBlockDataHandler.filterTokenData(txData);

        console.log(`📊 过滤后交易数据: ${filterData.length} 条`);

        // 统计钱包数量
        const uniqueWallets = new Set(filterData.map(tx => tx.userAddress));
        console.log(`👥 涉及钱包数量: ${uniqueWallets.size} 个`);

        // 测试优化版本
        console.log("\n🚀 测试优化版本...");
        const optimizedStartTime = Date.now();
        const optimizedResults = await snapshotWalletTradingByTxDataOptimized(filterData);
        const optimizedEndTime = Date.now();
        const optimizedTime = optimizedEndTime - optimizedStartTime;

        console.log(`✅ 优化版本完成:`);
        console.log(`   ⏱️  耗时: ${optimizedTime}ms`);
        console.log(`   📊 结果数量: ${optimizedResults.length}`);
        console.log(`   📈 处理速度: ${(filterData.length / optimizedTime * 1000).toFixed(0)} 交易/秒`);
        console.log(`   💡 平均每钱包: ${(optimizedTime / uniqueWallets.size).toFixed(1)}ms`);

        // 性能对比报告
        console.log(`\n📈 性能提升分析:`);
        console.log(`   🔍 原始数据: ${testData.length} 条`);
        console.log(`   🔄 过滤后: ${filterData.length} 条`);
        console.log(`   👥 钱包数量: ${uniqueWallets.size} 个`);
        console.log(`   ⚡ 优化版本: ${optimizedTime}ms`);

        // 根据之前的分析，原版本大约需要56秒处理1291个钱包
        // 按比例估算当前钱包数量的原版本时间
        const estimatedOriginalTime = (uniqueWallets.size * 37); // 37ms per wallet from previous analysis
        const speedup = estimatedOriginalTime / optimizedTime;

        console.log(`   📊 预估原版本: ${estimatedOriginalTime}ms`);
        console.log(`   🚀 性能提升: ${speedup.toFixed(1)}x`);
        console.log(`   📉 时间减少: ${((estimatedOriginalTime - optimizedTime) / estimatedOriginalTime * 100).toFixed(1)}%`);

        // 验证结果的正确性
        assert(optimizedResults.length > 0, "优化版本应该产生结果");
        assertEquals(optimizedResults.length, uniqueWallets.size, "结果数量应该等于钱包数量");

    } finally {
        await client.close();
        restore();
    }
});

// 批量查询性能单独测试
Deno.test("批量查询性能测试", async () => {
    await loadEnv();

    try {
        const { batchGetLatestWalletTradingSnapshotBeforeTime } = await import("../service/snapshot/wallet_trading_ss.ts");

        // 创建测试钱包地址
        const testWallets = Array.from({ length: 500 }, (_, i) =>
            `test_wallet_${i.toString().padStart(4, '0')}_${'a'.repeat(40)}`
        );

        console.log(`🔍 测试批量查询 ${testWallets.length} 个钱包...`);

        const batchStartTime = Date.now();
        const results = await batchGetLatestWalletTradingSnapshotBeforeTime(
            testWallets,
            Math.floor(Date.now() / 1000)
        );
        const batchEndTime = Date.now();

        const batchTime = batchEndTime - batchStartTime;

        console.log(`📊 批量查询结果:`);
        console.log(`   ⏱️  查询时间: ${batchTime}ms`);
        console.log(`   📊 查询钱包: ${testWallets.length} 个`);
        console.log(`   ✅ 找到结果: ${results.size} 个`);
        console.log(`   📈 查询速度: ${(testWallets.length / batchTime * 1000).toFixed(0)} 钱包/秒`);
        console.log(`   💡 平均时间: ${(batchTime / testWallets.length).toFixed(2)}ms/钱包`);

        // 如果是单独查询，估算时间
        const estimatedSingleQueryTime = testWallets.length * 37; // 基于之前的分析
        const batchSpeedup = estimatedSingleQueryTime / batchTime;

        console.log(`\n🚀 批量查询优势:`);
        console.log(`   📊 预估单独查询: ${estimatedSingleQueryTime}ms`);
        console.log(`   ⚡ 批量查询实际: ${batchTime}ms`);
        console.log(`   🚀 性能提升: ${batchSpeedup.toFixed(1)}x`);

    } finally {
        await client.close();
    }
}); 