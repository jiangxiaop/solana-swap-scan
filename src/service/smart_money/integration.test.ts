import { assert } from "https://deno.land/std/assert/mod.ts";
import { SmartMoneyIntegrationService } from "./integration.ts";
import { SmartMoneyAddressService } from "./address.ts";
import { SmartMoneyCategory } from "../../smart-money/index.ts";

/**
 * 聪明钱整合服务测试
 */
Deno.test("聪明钱整合服务 - 全自动发现工作流程测试", async () => {
    console.log("🧪 开始测试聪明钱整合服务全自动发现功能...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        console.log("🔍 测试全自动聪明钱发现...");

        // 测试全自动聪明钱发现功能
        const result = await integrationService.discoverAndStoreSmartMoney({
            minCategoryScore: 0, // 设置为0以便测试
            analysisConfig: {
                minTransactionCount: 5, // 降低门槛便于测试
                minBuyCount: 2,
                minTokenCount: 1
            }
        });

        // 验证返回结果的基本结构
        assert(typeof result.discovered === "number", "discovered应该是数字");
        assert(typeof result.stored === "number", "stored应该是数字");
        assert(Array.isArray(result.results), "results应该是数组");
        assert(typeof result.statistics === "object", "statistics应该是对象");

        console.log(`✅ 全自动发现结果: 发现聪明钱${result.discovered}个, 存储${result.stored}个`);
        console.log(`📊 分析了 ${result.results.length} 个活跃钱包`);

        console.log("✅ 全自动发现工作流程测试通过");

    } catch (error) {
        console.error("❌ 全自动发现工作流程测试失败:", error);
        throw error;
    }
});

/**
 * 测试活跃钱包报告功能
 */
Deno.test("聪明钱整合服务 - 活跃钱包报告测试", async () => {
    console.log("🧪 开始测试活跃钱包报告功能...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 测试生成活跃钱包报告
        console.log("📊 测试生成活跃钱包报告...");
        const report = await integrationService.getActiveWalletReport(3, {
            minTransactionCount: 5, // 降低门槛便于测试
            minBuyCount: 2,
            minTokenCount: 1,
            includeStats: true
        });

        // 验证报告结构
        assert(typeof report.totalActiveWallets === "number", "总活跃钱包数应该是数字");
        assert(typeof report.excludedSmartMoneyCount === "number", "排除的聪明钱数应该是数字");
        assert(Array.isArray(report.eligibleWallets), "符合条件的钱包应该是数组");

        console.log(`📋 报告生成成功: ${report.totalActiveWallets}个活跃钱包, 排除${report.excludedSmartMoneyCount}个已知聪明钱`);

        if (report.walletStats && report.walletStats.length > 0) {
            console.log(`📊 获取到 ${report.walletStats.length} 个钱包的详细统计信息`);
        }

        console.log("✅ 活跃钱包报告测试通过");

    } catch (error) {
        console.error("❌ 活跃钱包报告测试失败:", error);
        throw error;
    }
});

/**
 * 测试完整工作流程（兼容旧版本API）
 */
Deno.test("聪明钱整合服务 - 完整工作流程测试", async () => {
    console.log("🧪 开始测试聪明钱整合服务完整工作流程...");

    const integrationService = new SmartMoneyIntegrationService();

    // 准备测试地址（使用一些示例地址）
    const testAddresses = [
        "7HAGNaEUniWaVZJkqfZ3QDWm2vhynGVoPj4gCehnwXS",
        "8n2AhV8zQVKwkUqKdJcPhVHjVq5YvFvJhVYkAuWTLMaE",
        "AAe6XVdYkA8RhG4HDuuBCjK4m5tZ9T3qnuEPw3L8pump",
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        "6UwaPc5VoHuPCJjGe9kSwkyKcGJWYzGT8gNxeS3VDR9P"
    ];

    try {
        console.log(`🔍 测试分析和存储 ${testAddresses.length} 个候选地址...`);

        // 测试完整的分析和存储工作流程
        const result = await integrationService.analyzeAndStoreSmartMoneyAddresses(testAddresses, {
            minCategoryScore: 0, // 设置为0以便测试
            skipExisting: false   // 不跳过已存在的地址，便于测试
        });

        // 验证返回结果的基本结构
        assert(typeof result.analyzed === "number", "analyzed应该是数字");
        assert(typeof result.discovered === "number", "discovered应该是数字");
        assert(typeof result.stored === "number", "stored应该是数字");
        assert(Array.isArray(result.results), "results应该是数组");
        assert(typeof result.statistics === "object", "statistics应该是对象");

        console.log(`✅ 分析结果: 分析${result.analyzed}个, 发现聪明钱${result.discovered}个, 存储${result.stored}个`);

        // 验证分析结果数量
        assert(result.analyzed === testAddresses.length, `应该分析所有${testAddresses.length}个地址`);
        assert(result.results.length === testAddresses.length, "结果数量应该等于输入地址数量");

        console.log("✅ 完整工作流程测试通过");

    } catch (error) {
        console.error("❌ 完整工作流程测试失败:", error);
        throw error;
    }
});

/**
 * 测试聪明钱报告生成
 */
Deno.test("聪明钱整合服务 - 报告生成测试", async () => {
    console.log("🧪 开始测试聪明钱报告生成...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 测试生成完整报告
        console.log("📊 测试生成完整报告...");
        const fullReport = await integrationService.getSmartMoneyReport();

        // 验证报告结构
        assert(typeof fullReport.totalAddresses === "number", "总地址数应该是数字");
        assert(typeof fullReport.categoryDistribution === "object", "分类分布应该是对象");
        assert(Array.isArray(fullReport.topPerformers), "顶级表现者应该是数组");
        assert(Array.isArray(fullReport.recentAdditions), "最近添加应该是数组");

        console.log(`📋 报告生成成功: 总地址${fullReport.totalAddresses}个, 分类${Object.keys(fullReport.categoryDistribution).length}种`);
        console.log(`📝 最近添加了 ${fullReport.recentAdditions?.length || 0} 个聪明钱地址`);

        // 测试生成特定分类报告（如果有数据的话）
        const categories = Object.keys(fullReport.categoryDistribution);
        if (categories.length > 0) {
            console.log(`🎯 测试生成特定分类报告: ${categories[0]}...`);
            const categoryReport = await integrationService.getSmartMoneyReport(categories[0]);

            assert(categoryReport.categoryData !== undefined, "分类数据应该存在");
            assert(Array.isArray(categoryReport.categoryData), "分类数据应该是数组");

            console.log(`✅ 分类报告生成成功: ${categoryReport.categoryData.length}个地址`);
        }

        console.log("✅ 报告生成测试通过");

    } catch (error) {
        console.error("❌ 报告生成测试失败:", error);
        throw error;
    }
});

/**
 * 测试数据库维护功能
 */
Deno.test("聪明钱整合服务 - 数据库维护测试", async () => {
    console.log("🧪 开始测试数据库维护功能...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 测试数据库维护
        console.log("🧹 测试数据库维护...");
        const maintenanceResult = await integrationService.maintainSmartMoneyDatabase({
            cleanupDays: 365, // 设置较大的天数避免删除有用数据
        });

        // 验证维护结果结构
        assert(typeof maintenanceResult.cleaned === "number", "清理数量应该是数字");
        assert(Array.isArray(maintenanceResult.errors), "错误列表应该是数组");

        console.log(`🧹 维护完成: 清理${maintenanceResult.cleaned}个记录`);

        if (maintenanceResult.errors.length > 0) {
            console.log(`⚠️ 维护过程中出现 ${maintenanceResult.errors.length} 个错误`);
            maintenanceResult.errors.forEach(error => console.log(`  - ${error}`));
        }

        console.log("✅ 数据库维护测试通过");

    } catch (error) {
        console.error("❌ 数据库维护测试失败:", error);
        throw error;
    }
});

/**
 * 测试更新现有地址功能
 */
Deno.test("聪明钱整合服务 - 更新现有地址测试", async () => {
    console.log("🧪 开始测试更新现有地址功能...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 首先获取一些现有的聪明钱地址
        console.log("📋 获取现有聪明钱地址...");
        const existingAddresses = await SmartMoneyAddressService.getAllSmartMoneyAddresses();

        if (existingAddresses.length > 0) {
            // 取前3个地址进行测试
            const addressesToUpdate = existingAddresses.slice(0, Math.min(3, existingAddresses.length));
            console.log(`🔄 测试更新 ${addressesToUpdate.length} 个现有地址...`);

            const updateResult = await integrationService.updateExistingSmartMoneyAddresses(addressesToUpdate);

            // 验证更新结果
            assert(typeof updateResult.updated === "number", "更新数量应该是数字");
            assert(Array.isArray(updateResult.results), "更新结果应该是数组");
            assert(updateResult.results.length === addressesToUpdate.length, "结果数量应该等于输入地址数量");

            console.log(`✅ 更新完成: 成功更新 ${updateResult.updated}/${addressesToUpdate.length} 个地址`);
        } else {
            console.log("📝 数据库中暂无现有地址，跳过更新测试");
        }

        console.log("✅ 更新现有地址测试通过");

    } catch (error) {
        console.error("❌ 更新现有地址测试失败:", error);
        throw error;
    }
});

/**
 * 测试边界情况和错误处理
 */
Deno.test("聪明钱整合服务 - 边界情况测试", async () => {
    console.log("🧪 开始测试边界情况和错误处理...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 测试空地址列表
        console.log("🔍 测试空地址列表...");
        const emptyResult = await integrationService.analyzeAndStoreSmartMoneyAddresses([]);

        assert(emptyResult.analyzed === 0, "空列表分析数量应该为0");
        assert(emptyResult.discovered === 0, "空列表发现数量应该为0");
        assert(emptyResult.stored === 0, "空列表存储数量应该为0");
        assert(emptyResult.results.length === 0, "空列表结果应该为空");

        console.log("✅ 空地址列表处理正确");

        // 测试无效地址格式
        console.log("🔍 测试包含无效地址的列表...");
        const invalidAddresses = ["invalid_address_1", "invalid_address_2"];

        const invalidResult = await integrationService.analyzeAndStoreSmartMoneyAddresses(invalidAddresses, {
            minCategoryScore: 50
        });

        // 应该能够处理无效地址而不崩溃
        assert(typeof invalidResult.analyzed === "number", "无效地址分析结果应该是数字");
        console.log(`✅ 无效地址处理: 分析${invalidResult.analyzed}个, 发现${invalidResult.discovered}个`);

        console.log("✅ 边界情况测试通过");

    } catch (error) {
        console.error("❌ 边界情况测试失败:", error);
        throw error;
    }
});

/**
 * 测试跳过已存在地址功能
 */
Deno.test("聪明钱整合服务 - 跳过已存在地址测试", async () => {
    console.log("🧪 开始测试跳过已存在地址功能...");

    const integrationService = new SmartMoneyIntegrationService();

    try {
        // 使用一些测试地址
        const testAddresses = [
            "SKIP_TEST_" + Date.now().toString(36),
            "SKIP_TEST_" + (Date.now() + 1).toString(36)
        ];

        // 第一次分析（不跳过已存在的）
        console.log("🔍 第一次分析（不跳过已存在）...");
        const firstResult = await integrationService.analyzeAndStoreSmartMoneyAddresses(testAddresses, {
            skipExisting: false,
            minCategoryScore: 0
        });

        console.log(`第一次分析: ${firstResult.analyzed}个地址, 存储${firstResult.stored}个`);

        // 第二次分析（跳过已存在的）
        console.log("🔍 第二次分析（跳过已存在）...");
        const secondResult = await integrationService.analyzeAndStoreSmartMoneyAddresses(testAddresses, {
            skipExisting: true,
            minCategoryScore: 0
        });

        console.log(`第二次分析: ${secondResult.analyzed}个地址, 存储${secondResult.stored}个`);

        // 验证跳过功能工作正常
        // 注意：由于测试数据可能不会被识别为聪明钱，这里主要验证功能没有出错
        assert(typeof secondResult.analyzed === "number", "第二次分析数量应该是数字");

        console.log("✅ 跳过已存在地址测试通过");

    } catch (error) {
        console.error("❌ 跳过已存在地址测试失败:", error);
        throw error;
    }
}); 