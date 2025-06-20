import { SmartMoneyAnalyzer, type SmartMoneyAnalysisResult, SmartMoneyCategory } from "../../smart-money/index.ts";
import { SmartMoneyAddressService, type SmartMoneyAddressRecord } from "./address.ts";

/**
 * 聪明钱整合服务 - 结合分析器和地址数据库操作
 */
export class SmartMoneyIntegrationService {
    private analyzer: SmartMoneyAnalyzer;

    constructor() {
        this.analyzer = new SmartMoneyAnalyzer();
    }

    /**
     * 全自动聪明钱发现与存储工作流程
     * 基于过去三天的数据自动发现并存储聪明钱地址
     */
    async discoverAndStoreSmartMoney(options: {
        endTime?: number;
        minCategoryScore?: number;
        analysisConfig?: {
            minTransactionCount?: number;
            minBuyCount?: number;
            minTokenCount?: number;
        };
    } = {}): Promise<{
        discovered: number;
        stored: number;
        results: SmartMoneyAnalysisResult[];
        statistics: {
            byCategory: Record<string, number>;
            avgScore: number;
        };
    }> {
        const {
            endTime,
            minCategoryScore = 30,
        } = options;


        // 1. 自动获取并分析过去三天内的活跃钱包
        const analysisResults = await this.analyzer.analyzeActiveWallets(endTime);

        if (analysisResults.length === 0) {
            return {
                discovered: 0,
                stored: 0,
                results: [],
                statistics: { byCategory: {}, avgScore: 0 }
            };
        }

        // 2. 筛选出聪明钱（非普通用户且置信度足够）
        const smartMoneyResults = analysisResults.filter(result =>
            result.category !== SmartMoneyCategory.NORMAL &&
            result.categoryScore >= minCategoryScore
        );

        // 3. 转换为数据库记录格式
        const smartMoneyRecords: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'>[] =
            smartMoneyResults.map(result => ({
                address: result.metrics.walletAddress,
                category: result.category,
                category_score: result.categoryScore,
                mark_name: this.generateMarkName(result),
                last_analysis_time: new Date()
            }));

        // 4. 批量存储到数据库
        let storedCount = 0;
        if (smartMoneyRecords.length > 0) {
            storedCount = await SmartMoneyAddressService.batchInsertSmartMoneyAddresses(smartMoneyRecords);
        }

        // 5. 生成统计信息
        const statistics = this.generateStatistics(smartMoneyResults);


        return {
            discovered: smartMoneyResults.length,
            stored: storedCount,
            results: analysisResults,
            statistics
        };
    }

    /**
     * 完整的聪明钱分析和存储工作流程（兼容旧版本API）
     * @param candidateAddresses 候选钱包地址列表
     * @param options 分析选项
     */
    async analyzeAndStoreSmartMoneyAddresses(
        candidateAddresses: string[],
        options: {
            endTime?: number;
            minCategoryScore?: number;
            skipExisting?: boolean;
        } = {}
    ): Promise<{
        analyzed: number;
        discovered: number;
        stored: number;
        results: SmartMoneyAnalysisResult[];
        statistics: {
            byCategory: Record<string, number>;
            avgScore: number;
        };
    }> {
        const {
            endTime,
            minCategoryScore = 30,
            skipExisting = true
        } = options;

        // 1. 过滤已存在的地址（如果需要）
        let addressesToAnalyze = candidateAddresses;
        if (skipExisting) {
            addressesToAnalyze = await SmartMoneyAddressService.getNewAddressesToAnalyze(candidateAddresses);
        }

        if (addressesToAnalyze.length === 0) {
            return {
                analyzed: 0,
                discovered: 0,
                stored: 0,
                results: [],
                statistics: { byCategory: {}, avgScore: 0 }
            };
        }

        // 2. 批量分析钱包
        const analysisResults = await this.analyzer.analyzeWallets(addressesToAnalyze, endTime);

        // 3. 筛选出聪明钱（非普通用户且置信度足够）
        const smartMoneyResults = analysisResults.filter(result =>
            result.category !== SmartMoneyCategory.NORMAL &&
            result.categoryScore >= minCategoryScore
        );

        // 4. 转换为数据库记录格式
        const smartMoneyRecords: Omit<SmartMoneyAddressRecord, 'id' | 'created_at' | 'updated_at'>[] =
            smartMoneyResults.map(result => ({
                address: result.metrics.walletAddress,
                category: result.category,
                category_score: result.categoryScore,
                mark_name: this.generateMarkName(result),
                last_analysis_time: new Date()
            }));

        // 5. 批量存储到数据库
        let storedCount = 0;
        if (smartMoneyRecords.length > 0) {
            storedCount = await SmartMoneyAddressService.batchInsertSmartMoneyAddresses(smartMoneyRecords);
        }

        // 6. 生成统计信息
        const statistics = this.generateStatistics(smartMoneyResults);

        return {
            analyzed: analysisResults.length,
            discovered: smartMoneyResults.length,
            stored: storedCount,
            results: analysisResults,
            statistics
        };
    }

    /**
     * 获取活跃钱包分析报告
     * @param days 过去天数
     * @param options 筛选选项
     */
    async getActiveWalletReport(
        days: number = 3,
        options: {
            minTransactionCount?: number;
            minBuyCount?: number;
            minTokenCount?: number;
            includeStats?: boolean;
        } = {}
    ): Promise<{
        totalActiveWallets: number;
        excludedSmartMoneyCount: number;
        eligibleWallets: string[];
        walletStats?: any[];
    }> {
        const {
            minTransactionCount = 10,
            minBuyCount = 3,
            minTokenCount = 2,
            includeStats = false
        } = options;

        // 1. 获取活跃钱包地址
        const activeWallets = await SmartMoneyAddressService.getActiveWalletsExcludingSmartMoney(
            days,
            minTransactionCount,
            minBuyCount,
            minTokenCount
        );

        // 2. 获取已知聪明钱数量（用于统计）
        const smartMoneyStats = await SmartMoneyAddressService.getSmartMoneyStatistics();

        // 3. 获取详细统计信息（如果需要）
        let walletStats;
        if (includeStats && activeWallets.length > 0) {
            walletStats = await SmartMoneyAddressService.getActiveWalletStats(activeWallets, days);
        }

        return {
            totalActiveWallets: activeWallets.length,
            excludedSmartMoneyCount: smartMoneyStats.total,
            eligibleWallets: activeWallets,
            walletStats
        };
    }

    /**
     * 更新现有聪明钱地址的分析结果
     * @param addresses 要更新的地址列表
     * @param endTime 分析结束时间
     */
    async updateExistingSmartMoneyAddresses(
        addresses: string[],
        endTime?: number
    ): Promise<{
        updated: number;
        results: SmartMoneyAnalysisResult[];
    }> {
        // 1. 重新分析这些地址
        const analysisResults = await this.analyzer.analyzeWallets(addresses, endTime);

        // 2. 批量更新数据库记录
        let updatedCount = 0;
        for (const result of analysisResults) {
            const success = await SmartMoneyAddressService.updateSmartMoneyAddress(
                result.metrics.walletAddress,
                result.category,
                result.categoryScore,
                new Date()
            );
            if (success) updatedCount++;
        }

        return {
            updated: updatedCount,
            results: analysisResults
        };
    }

    /**
     * 获取聪明钱地址的分析报告
     * @param category 可选的分类筛选
     */
    async getSmartMoneyReport(category?: string): Promise<{
        totalAddresses: number;
        categoryDistribution: Record<string, number>;
        lastAnalysisTime: Date | null;
        topPerformers: SmartMoneyAddressRecord[];
        categoryData?: SmartMoneyAddressRecord[];
        recentAdditions?: SmartMoneyAddressRecord[];
    }> {
        // 1. 获取统计信息
        const statistics = await SmartMoneyAddressService.getSmartMoneyStatistics();

        // 2. 获取特定分类的数据（如果指定）
        let categoryData: SmartMoneyAddressRecord[] | undefined;
        if (category) {
            categoryData = await SmartMoneyAddressService.getSmartMoneyAddressesByCategory(category);
        }

        // 3. 获取各分类的顶级表现者
        const topPerformers: SmartMoneyAddressRecord[] = [];
        for (const cat of Object.keys(statistics.byCategory)) {
            const categoryAddresses = await SmartMoneyAddressService.getSmartMoneyAddressesByCategory(cat);
            if (categoryAddresses.length > 0) {
                topPerformers.push(categoryAddresses[0]); // 获取置信度最高的
            }
        }

        // 4. 获取最近添加的聪明钱地址
        const recentAdditions = await SmartMoneyAddressService.getRecentSmartMoneyAddresses(20);

        return {
            totalAddresses: statistics.total,
            categoryDistribution: statistics.byCategory,
            lastAnalysisTime: statistics.lastAnalysisTime,
            topPerformers,
            categoryData,
            recentAdditions
        };
    }

    /**
     * 清理和维护聪明钱数据库
     * @param options 清理选项
     */
    async maintainSmartMoneyDatabase(options: {
        cleanupDays?: number;
    } = {}): Promise<{
        cleaned: number;
        errors: string[];
    }> {
        const {
            cleanupDays = 30,
        } = options;

        const errors: string[] = [];
        let cleaned = 0;

        try {
            // 1. 清理过期记录
            cleaned = await SmartMoneyAddressService.cleanupOutdatedRecords(cleanupDays);

            // 2. 重新分析需要更新的地址
            // 这里可以扩展为获取需要重新分析的地址列表
            // 目前先跳过这个功能，因为需要额外的数据库查询逻辑

        } catch (error) {
            const errorMsg = `数据库维护失败: ${error instanceof Error ? error.message : String(error)}`;
            console.error("❌ " + errorMsg);
            errors.push(errorMsg);
        }

        return {
            cleaned,
            errors
        };
    }

    /**
     * 生成标记名称
     */
    private generateMarkName(result: SmartMoneyAnalysisResult): string {
        const { category, categoryScore, metrics } = result;

        const categoryNames: Record<SmartMoneyCategory, string> = {
            [SmartMoneyCategory.HIGH_WIN_RATE]: "高胜率用户",
            [SmartMoneyCategory.HIGH_PROFIT_RATE]: "高收益用户",
            [SmartMoneyCategory.WHALE_PROFIT]: "鲸鱼用户",
            [SmartMoneyCategory.NORMAL]: "普通用户"
        };

        const categoryName = categoryNames[category] || "未知分类";
        const profitInfo = metrics.profit > 0 ? `+${metrics.profit.toFixed(2)}SOL` : `${metrics.profit.toFixed(2)}SOL`;

        return `${categoryName}_置信度${categoryScore.toFixed(1)}%_收益${profitInfo}`;
    }

    /**
     * 生成统计信息
     */
    private generateStatistics(results: SmartMoneyAnalysisResult[]): {
        byCategory: Record<string, number>;
        avgScore: number;
    } {
        const byCategory: Record<string, number> = {};
        let totalScore = 0;

        for (const result of results) {
            byCategory[result.category] = (byCategory[result.category] || 0) + 1;
            totalScore += result.categoryScore;
        }

        const avgScore = results.length > 0 ? totalScore / results.length : 0;

        return { byCategory, avgScore };
    }


}

/**
 * 全局实例
 */
export const smartMoneyIntegration = new SmartMoneyIntegrationService(); 