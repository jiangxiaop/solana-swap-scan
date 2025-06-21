import { assert } from "https://deno.land/std/assert/mod.ts";
import { SmartMoneyCategory } from "./index.ts";
import { TestSmartMoneyAnalyzer } from "./test-analyzer.ts";
import { SnapShotForWalletTrading } from "../type/transaction.ts";
import {
    loadWalletSnapshotsForSmartMoneyAnalysis,
    extractWalletAddressesFromSnapshots,
    cleanupTestData
} from "../snap-shot/index.test.smart-money.ts";

// 全局变量存储测试数据
let testSnapshots: SnapShotForWalletTrading[] = [];
let testWalletAddresses: string[] = [];

/**
 * 设置测试环境
 */
async function setupTestEnvironment(): Promise<TestSmartMoneyAnalyzer> {
    console.log("🚀 设置聪明钱算法测试环境...");

    // 加载测试快照数据
    testSnapshots = await loadWalletSnapshotsForSmartMoneyAnalysis();
    testWalletAddresses = extractWalletAddressesFromSnapshots(testSnapshots);

    if (testSnapshots.length === 0) {
        throw new Error("❌ 没有找到测试快照数据。请先运行快照生成测试: deno test src/snap-shot/index.test.smart-money.ts");
    }

    console.log(`✅ 加载了 ${testSnapshots.length} 个快照，涵盖 ${testWalletAddresses.length} 个钱包`);

    // 创建测试分析器
    const analyzer = new TestSmartMoneyAnalyzer(testSnapshots);

    console.log("🔧 测试分析器创建完成");

    return analyzer;
}

/**
 * 测试单个钱包分析
 */
Deno.test("聪明钱算法 - 单个钱包分析测试", async () => {
    const analyzer = await setupTestEnvironment();

    // 选择一个有数据的钱包进行测试
    const testWalletAddress = testWalletAddresses[0];

    console.log(`🧠 测试分析钱包: ${testWalletAddress}`);

    try {
        const result = await analyzer.analyzeWallet(testWalletAddress);

        console.log("\n📊 分析结果:");
        console.log(`钱包: ${result.metrics.walletAddress.slice(0, 8)}...`);
        console.log(`分类: ${result.category}`);
        console.log(`置信度: ${result.categoryScore.toFixed(1)}%`);
        console.log(`原生代币余额: ${result.metrics.native_token_balance.toFixed(4)} SOL`);
        console.log(`总钱包余额: ${result.metrics.wallet_balance.toFixed(4)} SOL`);
        console.log(`代币胜率: ${(result.metrics.effective_win_token_pct * 100).toFixed(1)}%`);
        console.log(`总收益: ${result.metrics.profit.toFixed(4)} SOL`);
        console.log(`购买代币种类: ${result.metrics.buy_token_count}`);
        console.log(`活跃天数比例: ${(result.metrics.active_days_present * 100).toFixed(1)}%`);

        // 验证返回结果的基本结构
        assert(typeof result === "object", "结果应该是对象");
        assert(typeof result.metrics === "object", "metrics应该是对象");
        assert(typeof result.category === "string", "category应该是字符串");
        assert(typeof result.categoryScore === "number", "categoryScore应该是数字");

        // 验证钱包地址正确
        assert(result.metrics.walletAddress === testWalletAddress, "钱包地址应该匹配");

        // 验证分类是有效的枚举值
        const validCategories = Object.values(SmartMoneyCategory);
        assert(validCategories.includes(result.category as SmartMoneyCategory), "分类应该是有效的枚举值");

        // 验证置信度在合理范围内
        assert(result.categoryScore >= 0 && result.categoryScore <= 100, "置信度应该在0-100之间");

        console.log("✅ 单个钱包分析测试通过");

    } catch (error) {
        console.error("❌ 单个钱包分析测试失败:", error);
        throw error;
    }
});

/**
 * 测试批量钱包分析
 */
Deno.test("聪明钱算法 - 批量钱包分析测试", async () => {
    const analyzer = await setupTestEnvironment();

    // 选择前10个钱包进行批量测试
    const testWallets = testWalletAddresses.slice(0, Math.min(10, testWalletAddresses.length));

    console.log(`🧠 测试批量分析 ${testWallets.length} 个钱包`);

    try {
        const results = await analyzer.analyzeWallets(testWallets);

        console.log(`📊 批量分析完成，得到 ${results.length} 个结果`);

        // 验证结果数量
        assert(results.length === testWallets.length, "结果数量应该等于输入钱包数量");

        // 验证每个结果的基本结构
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const walletAddress = testWallets[i];

            assert(typeof result === "object", `结果${i}应该是对象`);
            assert(result.metrics.walletAddress === walletAddress, `结果${i}的钱包地址应该匹配`);
            assert(typeof result.category === "string", `结果${i}的category应该是字符串`);
            assert(typeof result.categoryScore === "number", `结果${i}的categoryScore应该是数字`);
        }

        // 获取统计信息
        const stats = analyzer.getSmartMoneyStats(results);

        console.log("\n📈 批量分析统计:");
        console.log(`总钱包数: ${stats.total}`);
        console.log("\n分类分布:");
        console.log(`  🎯 高胜率组: ${stats.byCategory[SmartMoneyCategory.HIGH_WIN_RATE]} (${((stats.byCategory[SmartMoneyCategory.HIGH_WIN_RATE] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  💰 高收益率组: ${stats.byCategory[SmartMoneyCategory.HIGH_PROFIT_RATE]} (${((stats.byCategory[SmartMoneyCategory.HIGH_PROFIT_RATE] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  🐋 鲸鱼盈利组: ${stats.byCategory[SmartMoneyCategory.WHALE_PROFIT]} (${((stats.byCategory[SmartMoneyCategory.WHALE_PROFIT] / stats.total) * 100).toFixed(1)}%)`);
        console.log(`  📊 普通用户: ${stats.byCategory[SmartMoneyCategory.NORMAL]} (${((stats.byCategory[SmartMoneyCategory.NORMAL] / stats.total) * 100).toFixed(1)}%)`);

        // 验证统计信息
        assert(stats.total === results.length, "统计总数应该等于结果数量");

        const categorySum = Object.values(stats.byCategory).reduce((sum, count) => sum + count, 0);
        assert(categorySum === stats.total, "分类数量总和应该等于总数");

        console.log("✅ 批量钱包分析测试通过");

    } catch (error) {
        console.error("❌ 批量钱包分析测试失败:", error);
        throw error;
    }
});

/**
 * 测试聪明钱分类算法
 */
Deno.test("聪明钱算法 - 分类算法测试", async () => {
    const analyzer = await setupTestEnvironment();

    // 分析所有可用的钱包
    const analysisWallets = testWalletAddresses.slice(0, Math.min(20, testWalletAddresses.length));

    console.log(`🧠 测试分类算法，分析 ${analysisWallets.length} 个钱包`);

    try {
        const results = await analyzer.analyzeWallets(analysisWallets);
        const stats = analyzer.getSmartMoneyStats(results);

        // 分类详细分析
        const categorizedResults = {
            [SmartMoneyCategory.HIGH_WIN_RATE]: results.filter(r => r.category === SmartMoneyCategory.HIGH_WIN_RATE),
            [SmartMoneyCategory.HIGH_PROFIT_RATE]: results.filter(r => r.category === SmartMoneyCategory.HIGH_PROFIT_RATE),
            [SmartMoneyCategory.WHALE_PROFIT]: results.filter(r => r.category === SmartMoneyCategory.WHALE_PROFIT),
            [SmartMoneyCategory.NORMAL]: results.filter(r => r.category === SmartMoneyCategory.NORMAL)
        };

        console.log("\n🔍 分类详细分析:");

        for (const [category, categoryResults] of Object.entries(categorizedResults)) {
            if (categoryResults.length > 0) {
                console.log(`\n${getCategoryDisplayName(category as SmartMoneyCategory)} (${categoryResults.length}个钱包):`);

                // 显示前3个最高置信度的钱包
                const topResults = categoryResults
                    .sort((a, b) => b.categoryScore - a.categoryScore)
                    .slice(0, 3);

                topResults.forEach((result, index) => {
                    console.log(`  ${index + 1}. ${result.metrics.walletAddress.slice(0, 8)}... - 置信度: ${result.categoryScore.toFixed(1)}% - 收益: ${result.metrics.profit.toFixed(4)} SOL`);
                });

                // 验证分类逻辑
                for (const result of categoryResults) {
                    assert(result.category === category, `分类应该一致: ${result.category} vs ${category}`);

                    // 根据分类验证关键指标
                    switch (category) {
                        case SmartMoneyCategory.HIGH_WIN_RATE:
                            // 高胜率组应该有较高的胜率
                            if (result.categoryScore > 50) { // 只对高置信度的进行验证
                                assert(result.metrics.effective_win_token_pct > 0.5,
                                    `高胜率组应该有较高胜率: ${result.metrics.effective_win_token_pct}`);
                            }
                            break;

                        case SmartMoneyCategory.HIGH_PROFIT_RATE:
                            // 高收益率组应该有正收益
                            if (result.categoryScore > 50) {
                                assert(result.metrics.profit > 0,
                                    `高收益率组应该有正收益: ${result.metrics.profit}`);
                            }
                            break;

                        case SmartMoneyCategory.WHALE_PROFIT:
                            // 鲸鱼组应该有较大的余额
                            if (result.categoryScore > 50) {
                                assert(result.metrics.native_token_balance > 50 || result.metrics.wallet_balance > 100,
                                    `鲸鱼组应该有较大余额: ${result.metrics.wallet_balance}`);
                            }
                            break;
                    }
                }
            }
        }

        // 导出详细结果用于分析
        const detailedResults = {
            timestamp: new Date().toISOString(),
            testData: {
                totalWallets: analysisWallets.length,
                totalSnapshots: testSnapshots.length
            },
            statistics: stats,
            detailedResults: results.map(r => ({
                walletAddress: r.metrics.walletAddress,
                category: r.category,
                categoryScore: r.categoryScore,
                metrics: r.metrics
            }))
        };

        await Deno.writeTextFile(
            "./test_data_for_smart_money/smart_money_analysis_test_results.json",
            JSON.stringify(detailedResults, null, 2)
        );

        console.log("\n💾 详细分析结果已保存到 ./test_data_for_smart_money/smart_money_analysis_test_results.json");
        console.log("✅ 分类算法测试通过");

    } catch (error) {
        console.error("❌ 分类算法测试失败:", error);
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

/**
 * 清理测试数据
 */
Deno.test("清理聪明钱测试数据", async () => {
    console.log("🧹 清理聪明钱测试数据...");
    await cleanupTestData();
    console.log("✅ 测试数据清理完成");
}); 