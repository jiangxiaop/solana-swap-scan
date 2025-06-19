import { assertEquals, assert } from "jsr:@std/assert";
import { stub, restore } from "jsr:@std/testing/mock";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import { SwapTransactionToken } from "../type/swap.ts";
import { snapshotTokenValueByTxData, snapshotTokenValueByTxDataOptimized } from "./token/index.ts";
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

Deno.test("Token快照处理性能对比测试", async () => {
    await loadEnv();
    const testData = await loadTestData();

    if (testData.length === 0) {
        console.log("⚠️ 没有测试数据，跳过Token性能测试");
        return;
    }

    try {
        // Mock数据获取函数
        const getDataStub = stub(
            SolanaBlockDataHandler,
            "getDataByBlockHeightRange",
            mockGetDataByBlockHeightRange
        );

        console.log(`🚀 开始Token快照性能对比测试，测试数据: ${testData.length} 条`);

        // 获取并过滤测试数据
        const txData = await SolanaBlockDataHandler.getDataByBlockHeightRange(347649500, 347649550);
        const filterData = SolanaBlockDataHandler.filterTokenData(txData);

        console.log(`📊 过滤后交易数据: ${filterData.length} 条`);

        // 统计token数量
        const uniqueTokens = new Set(filterData.map(tx => tx.tokenAddress));
        const uniqueTokenPools = new Set(filterData.map(tx => `${tx.tokenAddress}-${tx.poolAddress}`));
        console.log(`🪙 涉及Token数量: ${uniqueTokens.size} 个`);
        console.log(`🔗 Token-Pool组合: ${uniqueTokenPools.size} 个`);

        // 测试原版本
        console.log("\n📊 测试原版本...");
        const originalStartTime = Date.now();
        const originalResults = snapshotTokenValueByTxData(filterData);
        const originalEndTime = Date.now();
        const originalTime = originalEndTime - originalStartTime;

        console.log(`✅ 原版本完成:`);
        console.log(`   ⏱️  耗时: ${originalTime}ms`);
        console.log(`   📊 结果数量: ${originalResults.length}`);
        console.log(`   📈 处理速度: ${(filterData.length / originalTime * 1000).toFixed(0)} 交易/秒`);
        console.log(`   💡 平均每token-pool: ${(originalTime / originalResults.length).toFixed(1)}ms`);

        // 测试优化版本
        console.log("\n🚀 测试优化版本...");
        const optimizedStartTime = Date.now();
        const optimizedResults = await snapshotTokenValueByTxDataOptimized(filterData);
        const optimizedEndTime = Date.now();
        const optimizedTime = optimizedEndTime - optimizedStartTime;

        console.log(`✅ 优化版本完成:`);
        console.log(`   ⏱️  耗时: ${optimizedTime}ms`);
        console.log(`   📊 结果数量: ${optimizedResults.length}`);
        console.log(`   📈 处理速度: ${(filterData.length / optimizedTime * 1000).toFixed(0)} 交易/秒`);
        console.log(`   💡 平均每token-pool: ${(optimizedTime / optimizedResults.length).toFixed(1)}ms`);

        // 性能对比分析
        const speedup = originalTime / optimizedTime;
        console.log(`\n📈 Token快照性能提升分析:`);
        console.log(`   🔍 原始数据: ${testData.length} 条`);
        console.log(`   🔄 过滤后: ${filterData.length} 条`);
        console.log(`   🪙 Token数量: ${uniqueTokens.size} 个`);
        console.log(`   🔗 Token-Pool组合: ${uniqueTokenPools.size} 个`);
        console.log(`   📊 原版本: ${originalTime}ms`);
        console.log(`   ⚡ 优化版本: ${optimizedTime}ms`);
        console.log(`   🚀 性能提升: ${speedup.toFixed(1)}x`);
        console.log(`   📉 时间减少: ${((originalTime - optimizedTime) / originalTime * 100).toFixed(1)}%`);

        // 验证结果的正确性 - 数量应该相同
        assertEquals(originalResults.length, optimizedResults.length, "原版本和优化版本应该产生相同数量的结果");

        // 验证结果的一致性 - 抽样检查几个结果
        const sampleSize = Math.min(5, originalResults.length);
        for (let i = 0; i < sampleSize; i++) {
            const original = originalResults[i];
            const optimized = optimizedResults.find(r => 
                r.tokenAddress === original.tokenAddress && 
                r.poolAddress === original.poolAddress
            );
            
            assert(optimized, `应该找到token ${original.tokenAddress} pool ${original.poolAddress} 的优化结果`);
            
            // 验证关键数据一致性（允许浮点数精度差异）
            const tolerance = 0.0001;
            assert(Math.abs(original.buyAmount - optimized.buyAmount) < tolerance, "buyAmount应该一致");
            assert(Math.abs(original.sellAmount - optimized.sellAmount) < tolerance, "sellAmount应该一致");
            assertEquals(original.buyCount, optimized.buyCount, "buyCount应该一致");
            assertEquals(original.sellCount, optimized.sellCount, "sellCount应该一致");
            assertEquals(original.tokenAddress, optimized.tokenAddress, "tokenAddress应该一致");
            assertEquals(original.poolAddress, optimized.poolAddress, "poolAddress应该一致");
        }

        console.log(`✅ 数据一致性验证通过 - 抽样检查了 ${sampleSize} 个结果`);

    } finally {
        await client.close();
        restore();
    }
});

Deno.test("Token快照分组处理测试", async () => {
    await loadEnv();
    
    try {
        // 创建模拟数据 - 多个token，每个token有多个pool
        const mockData = [];
        const tokenCount = 20;
        const poolsPerToken = 3;
        const transactionsPerPool = 10;
        
        for (let t = 0; t < tokenCount; t++) {
            for (let p = 0; p < poolsPerToken; p++) {
                for (let i = 0; i < transactionsPerPool; i++) {
                    mockData.push({
                        userAddress: `wallet_${Math.floor(Math.random() * 100)}`,
                        poolAddress: `pool_${t}_${p}`,
                        txHash: `tx_${t}_${p}_${i}`,
                        isBuy: Math.random() > 0.5,
                        blockHeight: 100000 + i,
                        tokenSymbol: `TOKEN${t}`,
                        tokenAddress: `token_address_${t}`,
                        quoteSymbol: "SOL",
                        quoteAddress: "So11111111111111111111111111111111111111112",
                        quotePrice: 0.01 + Math.random() * 0.1,
                        usdPrice: 100 + Math.random() * 50,
                        usdAmount: 50 + Math.random() * 100,
                        transactionTime: (Date.now() - Math.random() * 1000000).toString(),
                        tokenAmount: 1000 + Math.random() * 5000,
                        quoteAmount: 1 + Math.random() * 5,
                    });
                }
            }
        }

        console.log(`🧪 Token分组测试 - 生成 ${mockData.length} 条模拟数据`);
        console.log(`   🪙 Token数量: ${tokenCount} 个`);
        console.log(`   🔗 每个Token的Pool数: ${poolsPerToken} 个`);
        console.log(`   📊 预期Token-Pool组合: ${tokenCount * poolsPerToken} 个`);

        // 测试优化版本的分组处理
        const startTime = Date.now();
        const results = await snapshotTokenValueByTxDataOptimized(mockData);
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        console.log(`\n📊 分组处理结果:`);
        console.log(`   ⏱️  处理时间: ${processingTime}ms`);
        console.log(`   📊 生成结果: ${results.length} 个快照`);
        console.log(`   📈 处理速度: ${(mockData.length / processingTime * 1000).toFixed(0)} 交易/秒`);

        // 验证结果正确性
        assertEquals(results.length, tokenCount * poolsPerToken, "应该生成正确数量的token-pool快照");

        // 验证每个token都有对应的快照
        const resultTokens = new Set(results.map(r => r.tokenAddress));
        assertEquals(resultTokens.size, tokenCount, "应该包含所有的token");

        console.log(`✅ Token分组处理测试通过`);

    } finally {
        await client.close();
    }
}); 