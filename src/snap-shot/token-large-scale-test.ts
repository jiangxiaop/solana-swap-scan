import { assertEquals, assert } from "jsr:@std/assert";
import { snapshotTokenValueByTxData, snapshotTokenValueByTxDataOptimized } from "./token/index.ts";
import { loadEnv } from "../../test/mock.ts";

// 生成大规模测试数据
function generateLargeScaleTestData(
    tokenCount: number,
    poolsPerToken: number,
    transactionsPerPool: number
) {
    const mockData = [];
    
    console.log(`🏭 生成大规模测试数据:`);
    console.log(`   🪙 Token数量: ${tokenCount}`);
    console.log(`   🔗 每个Token的Pool数: ${poolsPerToken}`);
    console.log(`   📊 每个Pool的交易数: ${transactionsPerPool}`);
    console.log(`   📈 总交易数: ${tokenCount * poolsPerToken * transactionsPerPool}`);

    for (let t = 0; t < tokenCount; t++) {
        for (let p = 0; p < poolsPerToken; p++) {
            for (let i = 0; i < transactionsPerPool; i++) {
                mockData.push({
                    userAddress: `wallet_${Math.floor(Math.random() * 1000)}`,
                    poolAddress: `pool_${t}_${p}`,
                    txHash: `tx_${t}_${p}_${i}`,
                    isBuy: Math.random() > 0.5,
                    blockHeight: 100000 + i,
                    tokenSymbol: `TOKEN${t}`,
                    tokenAddress: `token_address_${t.toString().padStart(4, '0')}`,
                    quoteSymbol: "SOL",
                    quoteAddress: "So11111111111111111111111111111111111111112",
                    quotePrice: 0.001 + Math.random() * 0.1,
                    usdPrice: 50 + Math.random() * 100,
                    usdAmount: 20 + Math.random() * 200,
                    transactionTime: (1700000000 + Math.random() * 1000000).toString(),
                    tokenAmount: 100 + Math.random() * 10000,
                    quoteAmount: 0.1 + Math.random() * 10,
                });
            }
        }
    }

    return mockData;
}

Deno.test("Token快照大规模性能测试 - 小规模", async () => {
    await loadEnv();
    
    // 小规模测试：100 tokens, 2 pools, 10 transactions = 2,000 transactions
    const smallData = generateLargeScaleTestData(100, 2, 10);
    
    console.log(`\n🔬 小规模性能测试 (${smallData.length} 笔交易):`);
    
    // 测试原版本
    const originalStart = Date.now();
    const originalResults = snapshotTokenValueByTxData(smallData);
    const originalTime = Date.now() - originalStart;
    
    // 测试优化版本  
    const optimizedStart = Date.now();
    const optimizedResults = await snapshotTokenValueByTxDataOptimized(smallData);
    const optimizedTime = Date.now() - optimizedStart;
    
    const speedup = originalTime / optimizedTime;
    
    console.log(`📊 小规模结果对比:`);
    console.log(`   📊 原版本: ${originalTime}ms (${(smallData.length/originalTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   ⚡ 优化版本: ${optimizedTime}ms (${(smallData.length/optimizedTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   🚀 性能比: ${speedup.toFixed(2)}x`);
    
    assertEquals(originalResults.length, optimizedResults.length, "结果数量应该一致");
});

Deno.test("Token快照大规模性能测试 - 中等规模", async () => {
    await loadEnv();
    
    // 中等规模测试：500 tokens, 3 pools, 20 transactions = 30,000 transactions
    const mediumData = generateLargeScaleTestData(500, 3, 20);
    
    console.log(`\n🔬 中等规模性能测试 (${mediumData.length} 笔交易):`);
    
    // 测试原版本
    const originalStart = Date.now();
    const originalResults = snapshotTokenValueByTxData(mediumData);
    const originalTime = Date.now() - originalStart;
    
    // 测试优化版本
    const optimizedStart = Date.now();
    const optimizedResults = await snapshotTokenValueByTxDataOptimized(mediumData);
    const optimizedTime = Date.now() - optimizedStart;
    
    const speedup = originalTime / optimizedTime;
    
    console.log(`📊 中等规模结果对比:`);
    console.log(`   📊 原版本: ${originalTime}ms (${(mediumData.length/originalTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   ⚡ 优化版本: ${optimizedTime}ms (${(mediumData.length/optimizedTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   🚀 性能比: ${speedup.toFixed(2)}x`);
    
    assertEquals(originalResults.length, optimizedResults.length, "结果数量应该一致");
});

Deno.test("Token快照大规模性能测试 - 大规模", async () => {
    await loadEnv();
    
    // 大规模测试：1000 tokens, 5 pools, 50 transactions = 250,000 transactions
    const largeData = generateLargeScaleTestData(1000, 5, 50);
    
    console.log(`\n🔬 大规模性能测试 (${largeData.length} 笔交易):`);
    
    // 测试原版本
    console.log(`🕐 测试原版本...`);
    const originalStart = Date.now();
    const originalResults = snapshotTokenValueByTxData(largeData);
    const originalTime = Date.now() - originalStart;
    
    // 测试优化版本
    console.log(`🕐 测试优化版本...`);
    const optimizedStart = Date.now();
    const optimizedResults = await snapshotTokenValueByTxDataOptimized(largeData);
    const optimizedTime = Date.now() - optimizedStart;
    
    const speedup = originalTime / optimizedTime;
    
    console.log(`📊 大规模结果对比:`);
    console.log(`   📊 原版本: ${originalTime}ms (${(largeData.length/originalTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   ⚡ 优化版本: ${optimizedTime}ms (${(largeData.length/optimizedTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   🚀 性能比: ${speedup.toFixed(2)}x`);
    console.log(`   📉 时间变化: ${speedup > 1 ? '提升' : '降低'} ${Math.abs((speedup - 1) * 100).toFixed(1)}%`);
    
    assertEquals(originalResults.length, optimizedResults.length, "结果数量应该一致");
    
    // 验证大规模数据下的正确性
    const sampleSize = Math.min(10, originalResults.length);
    let correctCount = 0;
    
    for (let i = 0; i < sampleSize; i++) {
        const original = originalResults[i];
        const optimized = optimizedResults.find(r => 
            r.tokenAddress === original.tokenAddress && 
            r.poolAddress === original.poolAddress
        );
        
        if (optimized && 
            Math.abs(original.buyAmount - optimized.buyAmount) < 0.01 &&
            original.buyCount === optimized.buyCount &&
            original.sellCount === optimized.sellCount) {
            correctCount++;
        }
    }
    
    console.log(`✅ 数据正确性验证: ${correctCount}/${sampleSize} 通过`);
    assert(correctCount >= sampleSize * 0.9, "至少90%的样本数据应该正确");
});

Deno.test("Token快照极限规模性能测试", async () => {
    await loadEnv();
    
    // 极限测试：2000 tokens, 5 pools, 100 transactions = 1,000,000 transactions
    const extremeData = generateLargeScaleTestData(2000, 5, 100);
    
    console.log(`\n🔬 极限规模性能测试 (${extremeData.length} 笔交易):`);
    console.log(`⚠️  这个测试可能需要较长时间...`);
    
    // 只测试优化版本（原版本可能太慢）
    console.log(`🕐 测试优化版本...`);
    const optimizedStart = Date.now();
    const optimizedResults = await snapshotTokenValueByTxDataOptimized(extremeData);
    const optimizedTime = Date.now() - optimizedStart;
    
    console.log(`📊 极限规模结果:`);
    console.log(`   ⚡ 优化版本: ${optimizedTime}ms (${(extremeData.length/optimizedTime*1000).toFixed(0)} 交易/秒)`);
    console.log(`   📦 生成快照: ${optimizedResults.length} 个`);
    console.log(`   🪙 处理Token: ${new Set(optimizedResults.map(r => r.tokenAddress)).size} 个`);
    console.log(`   ⏱️  平均每万笔交易: ${(optimizedTime / (extremeData.length / 10000)).toFixed(1)}ms`);
    
    assert(optimizedResults.length > 0, "应该生成快照结果");
    assert(optimizedTime < 60000, "处理时间应该在合理范围内（<60秒）");
}); 