import { SmartMoneyAnalyzer, SmartMoneyCategory, type SmartMoneyMetrics, type SmartMoneyAnalysisResult } from "./index.ts";

/**
 * Mock数据友好的聪明钱分析器，调整了分类阈值以更好地处理mock数据
 */
export class MockFriendlySmartMoneyAnalyzer extends SmartMoneyAnalyzer {
    
    /**
     * Override 聪明钱分类 - 调整阈值以适应mock数据
     */
    protected override classifySmartMoney(metrics: SmartMoneyMetrics): SmartMoneyCategory {
        const TWL = 1; // Time Window Length

        console.log(`🔍 分类钱包 ${metrics.walletAddress.slice(0, 8)}... 指标:`, {
            balance: metrics.native_token_balance.toFixed(2),
            profit: metrics.profit.toFixed(2),
            winRate: (metrics.effective_win_token_pct * 100).toFixed(1) + '%',
            tokenCount: metrics.buy_token_count,
            buyCount: metrics.token_buy_counts.toFixed(2),
            activeDays: (metrics.active_days_present * 100).toFixed(1) + '%'
        });

        // 高胜率组条件 - 降低活跃天数和买入次数要求
        const isHighWinRate = (
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) &&
            metrics.profit > 0.025 * TWL &&
            metrics.effective_win_token_pct > 0.6 &&
            metrics.token_buy_counts > 0.1 * TWL &&  // 从0.3降低到0.1
            metrics.active_days_present > 0.1 * TWL  // 从0.3降低到0.1
        );

        // 高收益率组条件 - 降低活跃天数要求
        const isHighProfitRate = (
            metrics.profit > 0.7 * TWL &&
            metrics.effective_win_token_pct > 0.5 &&
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) &&
            metrics.token_buy_counts > 0.05 * TWL &&  // 从0.1降低到0.05
            metrics.active_days_present > 0.1 * TWL   // 从0.3降低到0.1
        );

        // 鲸鱼盈利组条件 - 降低余额要求和活跃天数要求
        const isWhaleProfit = (
            (metrics.native_token_balance > 100 || metrics.wallet_balance > 200) && // 从1000/2000降低到100/200
            metrics.effective_win_token_pct > 0.3 &&
            metrics.token_buy_counts > 0.05 * TWL &&  // 从0.1降低到0.05
            metrics.active_days_present > 0.1 * TWL   // 从0.3降低到0.1
        );

        let selectedCategory = SmartMoneyCategory.NORMAL;
        const conditions = {
            isHighWinRate,
            isHighProfitRate, 
            isWhaleProfit
        };

        // 优先级排序：鲸鱼 > 高收益率 > 高胜率 > 普通
        if (isWhaleProfit) {
            selectedCategory = SmartMoneyCategory.WHALE_PROFIT;
        } else if (isHighProfitRate) {
            selectedCategory = SmartMoneyCategory.HIGH_PROFIT_RATE;
        } else if (isHighWinRate) {
            selectedCategory = SmartMoneyCategory.HIGH_WIN_RATE;
        }

        console.log(`📊 分类结果: ${selectedCategory}`, conditions);
        
        return selectedCategory;
    }

    /**
     * Override 计算分类置信度分数 - 调整计算方式以适应mock数据
     */
    protected override calculateCategoryScore(metrics: SmartMoneyMetrics, category: SmartMoneyCategory): number {
        const TWL = 1;
        let score = 0;

        switch (category) {
            case SmartMoneyCategory.HIGH_WIN_RATE:
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.profit / (0.025 * TWL), 2) * 20;
                score += Math.min(metrics.effective_win_token_pct / 0.6, 1) * 20;
                score += Math.min(metrics.token_buy_counts / (0.1 * TWL), 1) * 20;  // 调整
                score += Math.min(metrics.active_days_present / (0.1 * TWL), 1) * 20; // 调整
                break;

            case SmartMoneyCategory.HIGH_PROFIT_RATE:
                score += Math.min(metrics.profit / (0.7 * TWL), 2) * 30;
                score += Math.min(metrics.effective_win_token_pct / 0.5, 1) * 25;
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.token_buy_counts / (0.05 * TWL), 1) * 15;  // 调整
                score += Math.min(metrics.active_days_present / (0.1 * TWL), 1) * 10; // 调整
                break;

            case SmartMoneyCategory.WHALE_PROFIT:
                score += (metrics.native_token_balance > 100 || metrics.wallet_balance > 200) ? 40 : 0; // 调整
                score += Math.min(metrics.effective_win_token_pct / 0.3, 1) * 30;
                score += Math.min(metrics.token_buy_counts / (0.05 * TWL), 1) * 15;  // 调整
                score += Math.min(metrics.active_days_present / (0.1 * TWL), 1) * 15; // 调整
                break;

            default:
                score = 0;
        }

        return Math.min(score, 100);
    }
}

/**
 * Mock数据友好的测试分析器，结合了测试数据加载和友好的分类阈值
 */
export class MockFriendlyTestAnalyzer extends MockFriendlySmartMoneyAnalyzer {
    private testSnapshots: any[] = [];

    constructor(testSnapshots: any[]) {
        super();
        this.testSnapshots = testSnapshots;
    }

    /**
     * Override 获取钱包快照的方法
     */
    protected override async getWalletSnapshotsInRange(
        walletAddress: string, 
        startTime: number, 
        endTime: number
    ): Promise<any[]> {
        // 首先尝试按时间范围过滤
        let filteredSnapshots = this.testSnapshots.filter(snapshot => {
            const snapshotTime = parseInt(snapshot.snapshotTime);
            return snapshot.walletAddress === walletAddress &&
                   snapshotTime >= startTime &&
                   snapshotTime <= endTime;
        });
        
        // 如果按时间范围找不到数据，就返回该钱包的所有快照
        if (filteredSnapshots.length === 0) {
            filteredSnapshots = this.testSnapshots.filter(snapshot => {
                return snapshot.walletAddress === walletAddress;
            });
            
            if (filteredSnapshots.length > 0) {
                console.log(`🔄 时间范围查询无结果，返回钱包 ${walletAddress.slice(0, 8)}... 的所有 ${filteredSnapshots.length} 个快照`);
            }
        }
        
        // 按时间倒序排列
        filteredSnapshots.sort((a, b) => 
            parseInt(b.snapshotTime) - parseInt(a.snapshotTime)
        );
        
        // console.log(`测试查询钱包 ${walletAddress.slice(0, 8)}... 在时间范围 ${startTime}-${endTime} 找到 ${filteredSnapshots.length} 个快照`);
        
        return filteredSnapshots;
    }

    /**
     * Override 获取基准快照的方法
     */
    protected override async getBaselineSnapshot(
        walletAddress: string, 
        analysisStartTime: number
    ): Promise<any | null> {
        let snapshots = this.testSnapshots.filter(snapshot => {
            const snapshotTime = parseInt(snapshot.snapshotTime);
            return snapshot.walletAddress === walletAddress && snapshotTime < analysisStartTime;
        });
        
        if (snapshots.length === 0) {
            return null;
        }
        
        snapshots.sort((a, b) => 
            parseInt(b.snapshotTime) - parseInt(a.snapshotTime)
        );
        
        return snapshots[0];
    }
} 