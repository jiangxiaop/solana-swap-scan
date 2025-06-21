#!/usr/bin/env -S deno test --allow-all

import { assert } from "https://deno.land/std/assert/mod.ts";
import { SmartMoneyCategory } from "./index.ts";
import { MockFriendlyTestAnalyzer } from "./mock-friendly-analyzer.ts";
import { SnapShotForWalletTrading } from "../type/transaction.ts";
import {
    loadWalletSnapshotsForSmartMoneyAnalysis,
    extractWalletAddressesFromSnapshots
} from "../snap-shot/index.test.smart-money.ts";

// 全局变量存储测试数据
let testSnapshots: SnapShotForWalletTrading[] = [];
let testWalletAddresses: string[] = [];

/**
 * 设置增强测试环境
 */
async function setupEnhancedTestEnvironment(): Promise<MockFriendlyTestAnalyzer> {
    console.log("🚀 设置增强聪明钱算法测试环境...");

    // 加载测试快照数据
    testSnapshots = await loadWalletSnapshotsForSmartMoneyAnalysis();
    testWalletAddresses = extractWalletAddressesFromSnapshots(testSnapshots);

    if (testSnapshots.length === 0) {
        throw new Error("❌ 没有找到测试快照数据。请先运行快照生成测试或mock数据生成器");
    }

    console.log(`✅ 加载了 ${testSnapshots.length} 个快照，涵盖 ${testWalletAddresses.length} 个钱包`);

    // 创建增强测试分析器
    const analyzer = new MockFriendlyTestAnalyzer(testSnapshots);

    console.log("🔧 增强测试分析器创建完成");

    return analyzer;
}

/**
 * 测试增强版聪明钱分类算法
 */
Deno.test("增强聪明钱算法 - 调整阈值分类测试", async () => {
    const analyzer = await setupEnhancedTestEnvironment();

    // 分析前50个钱包，看看分类效果
    const analysisWallets = testWalletAddresses.slice(0, Math.min(1, testWalletAddresses.length));

    console.log(`🧠 使用调整后的阈值分析 ${analysisWallets.length} 个钱包`);

    try {
        const results = await analyzer.analyzeWallets(analysisWallets);
        const stats = analyzer.getSmartMoneyStats(results);

        console.log("\n📈 增强分析统计:");
        console.log(`总钱包数: ${stats.total}`);
        console.log("\n分类分布:");
        console.log(`  🎯 高胜率组: ${stats.byCategory[SmartMoneyCategory.HIGH_WIN_RATE]} (${((stats.byCategory[SmartMoneyCategory.HIGH_WIN_RATE] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  💰 高收益率组: ${stats.byCategory[SmartMoneyCategory.HIGH_PROFIT_RATE]} (${((stats.byCategory[SmartMoneyCategory.HIGH_PROFIT_RATE] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  🐋 鲸鱼盈利组: ${stats.byCategory[SmartMoneyCategory.WHALE_PROFIT]} (${((stats.byCategory[SmartMoneyCategory.WHALE_PROFIT] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  📊 普通用户: ${stats.byCategory[SmartMoneyCategory.NORMAL]} (${((stats.byCategory[SmartMoneyCategory.NORMAL] / stats.total) * 100).toFixed(1)}%)`);

        console.log("\n💡 平均指标:");
        console.log(`  💰 平均余额: ${stats.avgMetrics.native_token_balance.toFixed(2)} SOL`);
        console.log(`  📈 平均收益: ${stats.avgMetrics.profit.toFixed(2)} SOL`);
        console.log(`  🎯 平均胜率: ${(stats.avgMetrics.effective_win_token_pct * 100).toFixed(1)}%`);
        console.log(`  🪙 平均代币数: ${stats.avgMetrics.buy_token_count.toFixed(1)}`);

        // 验证基本结果
        assert(results.length === analysisWallets.length, "结果数量应该等于输入钱包数量");
        assert(stats.total === results.length, "统计总数应该等于结果数量");

        // 检查是否有非普通用户的分类
        const smartMoneyCount = stats.byCategory[SmartMoneyCategory.HIGH_WIN_RATE] + 
                               stats.byCategory[SmartMoneyCategory.HIGH_PROFIT_RATE] + 
                               stats.byCategory[SmartMoneyCategory.WHALE_PROFIT];

        console.log(`\n🔍 聪明钱识别结果: ${smartMoneyCount}/${stats.total} 个钱包被识别为聪明钱`);

        if (smartMoneyCount > 0) {
            console.log("\n🎉 成功识别出聪明钱钱包！");
            
            // 显示每个类别的最高置信度钱包
            const categorizedResults = {
                [SmartMoneyCategory.HIGH_WIN_RATE]: results.filter(r => r.category === SmartMoneyCategory.HIGH_WIN_RATE),
                [SmartMoneyCategory.HIGH_PROFIT_RATE]: results.filter(r => r.category === SmartMoneyCategory.HIGH_PROFIT_RATE),
                [SmartMoneyCategory.WHALE_PROFIT]: results.filter(r => r.category === SmartMoneyCategory.WHALE_PROFIT),
            };

            for (const [category, categoryResults] of Object.entries(categorizedResults)) {
                if (categoryResults.length > 0) {
                    console.log(`\n${getCategoryDisplayName(category as SmartMoneyCategory)} - 最佳钱包:`);
                    const bestWallet = categoryResults.sort((a, b) => b.categoryScore - a.categoryScore)[0];
                    console.log(`  📍 ${bestWallet.metrics.walletAddress.slice(0, 8)}...`);
                    console.log(`  🏆 置信度: ${bestWallet.categoryScore.toFixed(1)}%`);
                    console.log(`  💰 余额: ${bestWallet.metrics.native_token_balance.toFixed(2)} SOL`);
                    console.log(`  📈 收益: ${bestWallet.metrics.profit.toFixed(2)} SOL`);
                    console.log(`  🎯 胜率: ${(bestWallet.metrics.effective_win_token_pct * 100).toFixed(1)}%`);
                }
            }
        } else {
            console.log("\n⚠️ 没有识别出聪明钱，可能需要进一步调整阈值");
        }

        // 保存详细结果
        const detailedResults = {
            timestamp: new Date().toISOString(),
            testType: "enhanced_smart_money_analysis",
            testData: {
                totalWallets: analysisWallets.length,
                totalSnapshots: testSnapshots.length,
                thresholdAdjustments: "降低活跃天数和买入次数要求"
            },
            statistics: stats,
            smartMoneyCount,
            detailedResults: results.map(r => ({
                walletAddress: r.metrics.walletAddress,
                category: r.category,
                categoryScore: r.categoryScore,
                metrics: r.metrics
            }))
        };

        await Deno.writeTextFile(
            "./test_data_for_smart_money/enhanced_smart_money_analysis_results.json",
            JSON.stringify(detailedResults, null, 2)
        );

        console.log("\n💾 增强分析结果已保存到 ./test_data_for_smart_money/enhanced_smart_money_analysis_results.json");
        console.log("✅ 增强分类算法测试完成");

    } catch (error) {
        console.error("❌ 增强分类算法测试失败:", error);
        throw error;
    }
});

/**
 * 获取分类显示名称
 */
function getCategoryDisplayName(category: SmartMoneyCategory): string {
    switch (category) {
        case SmartMoneyCategory.HIGH_WIN_RATE:
            return "🎯 高胜率组";
        case SmartMoneyCategory.HIGH_PROFIT_RATE:
            return "💰 高收益率组";
        case SmartMoneyCategory.WHALE_PROFIT:
            return "🐋 鲸鱼盈利组";
        case SmartMoneyCategory.NORMAL:
            return "📊 普通用户";
        default:
            return "❓ 未知分类";
    }
} 