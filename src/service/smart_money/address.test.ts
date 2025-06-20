import { assert } from "https://deno.land/std/assert/mod.ts";
import { SmartMoneyAddressService, type SmartMoneyAddressRecord, type ActiveWalletStats } from "./address.ts";

/**
 * 聪明钱地址服务测试
 */
Deno.test("聪明钱地址服务 - 基础数据库操作测试", async () => {
    console.log("🧪 开始测试聪明钱地址服务基础功能...");

    try {
        // 测试获取统计信息
        console.log("📊 测试获取统计信息...");
        const initialStats = await SmartMoneyAddressService.getSmartMoneyStatistics();
        assert(typeof initialStats.total === "number", "总数应该是数字");
        assert(typeof initialStats.byCategory === "object", "分类统计应该是对象");
        console.log(`✅ 当前数据库中有 ${initialStats.total} 个聪明钱地址`);

        // 测试批量检查功能
        console.log("🔍 测试批量检查功能...");
        const testAddresses = [
            "7HAGNaEUniWaVZJkqfZ3QDWm2vhynGVoPj4gCehnwXS",
            "8n2AhV8zQVKwkUqKdJcPhVHjVq5YvFvJhVYkAuWTLMaE",
            "AAe6XVdYkA8RhG4HDuuBCjK4m5tZ9T3qnuEPw3L8pump"
        ];

        const existingAddresses = await SmartMoneyAddressService.filterExistingSmartMoneyAddresses(testAddresses);
        console.log(`📋 检查了 ${testAddresses.length} 个地址，找到 ${existingAddresses.length} 个已存在的`);

        // 测试获取新地址待分析功能
        const newAddresses = await SmartMoneyAddressService.getNewAddressesToAnalyze(testAddresses);
        assert(Array.isArray(newAddresses), "新地址列表应该是数组");
        console.log(`📝 待分析的新地址数量: ${newAddresses.length}`);

        console.log("✅ 基础数据库操作测试通过");

    } catch (error) {
        console.error("❌ 基础数据库操作测试失败:", error);
        throw error;
    }
});

/**
 * 测试活跃钱包获取功能
 */
Deno.test("聪明钱地址服务 - 活跃钱包获取测试", async () => {
    console.log("🧪 开始测试活跃钱包获取功能...");

    try {
        // 测试获取活跃钱包地址（排除聪明钱）
        console.log("🔍 测试获取活跃钱包地址...");
        const activeWallets = await SmartMoneyAddressService.getActiveWalletsExcludingSmartMoney(
            3, // 过去3天
            5, // 最低5笔交易（降低门槛便于测试）
            2, // 最低2次买入
            1  // 最低1种代币
        );

        assert(Array.isArray(activeWallets), "活跃钱包列表应该是数组");
        console.log(`✅ 找到 ${activeWallets.length} 个活跃钱包地址`);


        Deno.writeTextFileSync("active_wallets.json ", JSON.stringify(activeWallets, null, 2));

        // 测试获取活跃钱包统计信息
        if (activeWallets.length > 0) {
            console.log("📊 测试获取活跃钱包统计信息...");
            const walletStats = await SmartMoneyAddressService.getActiveWalletStats(
                activeWallets.slice(0, 1000), // 只取前10个进行测试
                3
            );

            assert(Array.isArray(walletStats), "钱包统计应该是数组");

            if (walletStats.length > 0) {
                const firstStat = walletStats[0];
                assert(typeof firstStat.walletAddress === "string", "钱包地址应该是字符串");
                assert(typeof firstStat.totalTransactions === "number", "总交易数应该是数字");
                assert(typeof firstStat.uniqueTokens === "number", "唯一代币数应该是数字");
                console.log(`✅ 获取到 ${walletStats.length} 个钱包的详细统计信息`);
                console.log(`📋 第一个钱包: ${firstStat.walletAddress.slice(0, 8)}... - ${firstStat.totalTransactions} 笔交易`);
            }
        }

        console.log("✅ 活跃钱包获取测试通过");

    } catch (error) {
        console.error("❌ 活跃钱包获取测试失败:", error);
        throw error;
    }
});

/**
 * 测试聪明钱地址的插入和更新功能
 */
Deno.test("聪明钱地址服务 - 插入和更新测试", async () => {
    console.log("🧪 开始测试聪明钱地址插入和更新功能...");

    const testAddress = "TEST_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);

    try {
        // 测试插入单个地址
        console.log("➕ 测试插入单个聪明钱地址...");
        const testRecord: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'> = {
            address: testAddress,
            category: "high_win_rate",
            category_score: 85.5,
            mark_name: "测试用户_高胜率",
            last_analysis_time: new Date()
        };

        const insertSuccess = await SmartMoneyAddressService.insertSmartMoneyAddress(testRecord);
        assert(insertSuccess === true, "插入操作应该成功");
        console.log(`✅ 成功插入测试地址: ${testAddress.slice(0, 12)}...`);

        // 验证地址已存在
        const isExisting = await SmartMoneyAddressService.isSmartMoneyAddress(testAddress);
        assert(isExisting === true, "插入的地址应该被检测为已存在");
        console.log("✅ 地址存在性验证通过");

        // 测试更新功能
        console.log("🔄 测试更新聪明钱地址...");
        const updateSuccess = await SmartMoneyAddressService.updateSmartMoneyAddress(
            testAddress,
            "high_profit_rate",
            92.3,
            new Date()
        );
        assert(updateSuccess === true, "更新操作应该成功");
        console.log("✅ 地址更新成功");

        // 测试按分类获取
        console.log("📋 测试按分类获取地址...");
        const highProfitAddresses = await SmartMoneyAddressService.getSmartMoneyAddressesByCategory("high_profit_rate");
        assert(Array.isArray(highProfitAddresses), "分类查询结果应该是数组");

        const testAddressInResults = highProfitAddresses.find(record => record.address === testAddress);
        assert(testAddressInResults !== undefined, "更新后的地址应该在新分类中找到");
        assert(testAddressInResults.category === "high_profit_rate", "分类应该已更新");
        assert(Math.abs(testAddressInResults.category_score - 92.3) < 0.1, "置信度应该已更新");
        console.log("✅ 分类查询验证通过");

        console.log("✅ 插入和更新测试通过");

    } catch (error) {
        console.error("❌ 插入和更新测试失败:", error);
        throw error;
    }
});

/**
 * 测试批量操作功能
 */
Deno.test("聪明钱地址服务 - 批量操作测试", async () => {
    console.log("🧪 开始测试批量操作功能...");

    const timestamp = Date.now().toString(36);
    const testAddresses = [
        `BATCH_TEST_1_${timestamp}`,
        `BATCH_TEST_2_${timestamp}`,
        `BATCH_TEST_3_${timestamp}`
    ];

    try {
        // 准备批量测试数据
        const batchRecords: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'>[] = testAddresses.map((address, index) => ({
            address,
            category: index % 2 === 0 ? "high_win_rate" : "whale_profit",
            category_score: 70 + (index * 5),
            mark_name: `批量测试_${index + 1}`,
            last_analysis_time: new Date()
        }));

        // 测试批量插入
        console.log(`📦 测试批量插入 ${batchRecords.length} 个地址...`);
        const successCount = await SmartMoneyAddressService.batchInsertSmartMoneyAddresses(batchRecords);
        assert(successCount === batchRecords.length, `应该成功插入所有 ${batchRecords.length} 个地址`);
        console.log(`✅ 批量插入成功: ${successCount}/${batchRecords.length}`);

        // 验证批量检查功能
        console.log("🔍 验证批量检查功能...");
        const existingAfterInsert = await SmartMoneyAddressService.filterExistingSmartMoneyAddresses(testAddresses);
        assert(existingAfterInsert.length === testAddresses.length, "所有测试地址都应该被检测为已存在");
        console.log("✅ 批量检查验证通过");

        // 测试获取更新后的统计信息
        console.log("📊 测试更新后的统计信息...");
        const updatedStats = await SmartMoneyAddressService.getSmartMoneyStatistics();
        assert(updatedStats.total >= testAddresses.length, "总数应该包含新插入的地址");
        console.log(`✅ 更新后统计信息: 总计 ${updatedStats.total} 个地址`);

        console.log("✅ 批量操作测试通过");

    } catch (error) {
        console.error("❌ 批量操作测试失败:", error);
        throw error;
    }
});

/**
 * 测试新增功能
 */
Deno.test("聪明钱地址服务 - 新增功能测试", async () => {
    console.log("🧪 开始测试新增功能...");

    try {
        // 测试获取最近添加的聪明钱地址
        console.log("📋 测试获取最近添加的聪明钱地址...");
        const recentAddresses = await SmartMoneyAddressService.getRecentSmartMoneyAddresses(10);
        assert(Array.isArray(recentAddresses), "最近地址列表应该是数组");
        console.log(`✅ 获取到 ${recentAddresses.length} 个最近添加的地址`);

        // 测试获取分析历史（如果有数据的话）
        if (recentAddresses.length > 0) {
            console.log("📊 测试获取分析历史...");
            const testAddress = recentAddresses[0].address;
            const analysisHistory = await SmartMoneyAddressService.getSmartMoneyAnalysisHistory(testAddress);

            if (analysisHistory) {
                assert(analysisHistory.address === testAddress, "返回的地址应该匹配");
                assert(Array.isArray(analysisHistory.analysisHistory), "分析历史应该是数组");
                console.log(`✅ 获取到地址 ${testAddress.slice(0, 8)}... 的分析历史`);
            } else {
                console.log("📝 该地址暂无分析历史记录");
            }
        }

        console.log("✅ 新增功能测试通过");

    } catch (error) {
        console.error("❌ 新增功能测试失败:", error);
        throw error;
    }
});

/**
 * 测试清理功能
 */
Deno.test("聪明钱地址服务 - 清理功能测试", async () => {
    console.log("🧪 开始测试清理功能...");

    try {
        // 测试清理过期记录（这里设置一个较大的天数，避免删除有用数据）
        console.log("🧹 测试清理过期记录...");
        const cleanedCount = await SmartMoneyAddressService.cleanupOutdatedRecords(365); // 清理超过1年的记录
        assert(typeof cleanedCount === "number", "清理数量应该是数字");
        console.log(`✅ 清理了 ${cleanedCount} 个过期记录`);

        console.log("✅ 清理功能测试通过");

    } catch (error) {
        console.error("❌ 清理功能测试失败:", error);
        throw error;
    }
});

/**
 * 测试错误处理
 */
Deno.test("聪明钱地址服务 - 错误处理测试", async () => {
    console.log("🧪 开始测试错误处理...");

    try {
        // 测试空数组的批量检查
        console.log("🔍 测试空数组批量检查...");
        const emptyResult = await SmartMoneyAddressService.filterExistingSmartMoneyAddresses([]);
        assert(Array.isArray(emptyResult), "空数组检查结果应该是数组");
        assert(emptyResult.length === 0, "空数组检查结果应该为空");
        console.log("✅ 空数组处理正确");

        // 测试获取不存在分类的地址
        console.log("📋 测试获取不存在分类的地址...");
        const nonExistentCategory = await SmartMoneyAddressService.getSmartMoneyAddressesByCategory("non_existent_category");
        assert(Array.isArray(nonExistentCategory), "不存在分类查询结果应该是数组");
        console.log("✅ 不存在分类处理正确");

        // 测试空活跃钱包统计
        console.log("📊 测试空活跃钱包统计...");
        const emptyStats = await SmartMoneyAddressService.getActiveWalletStats([]);
        assert(Array.isArray(emptyStats), "空钱包统计结果应该是数组");
        assert(emptyStats.length === 0, "空钱包统计结果应该为空");
        console.log("✅ 空钱包统计处理正确");

        console.log("✅ 错误处理测试通过");

    } catch (error) {
        console.error("❌ 错误处理测试失败:", error);
        throw error;
    }
}); 