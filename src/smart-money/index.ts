import { SnapShotForWalletTrading } from "../type/transaction.ts";
import { TokenNormSnapShot } from "../type/transaction.ts";
import { getLatestWalletTradingSnapshot, getWalletTradingSnapshotsByTimeRange } from "../service/snapshot/wallet_trading_ss.ts";
import { SmartMoneyAddressService } from "../service/smart_money/address.ts";

// 聪明钱指标接口
export interface SmartMoneyMetrics {
    walletAddress: string;
    analysisStartTime: number;
    analysisEndTime: number;
    
    // 基础财务指标
    native_token_balance: number;  // SOL计价的原生代币总价值
    wallet_balance: number;        // 账户总资产价值
    
    // 交易活跃度指标
    buy_token_count: number;       // 购买的代币种类数量
    active_days_present: number;   // 有交易活动的天数比率 (0-1)
    token_buy_counts: number;      // 平均每种代币的购买次数
    
    // 收益相关指标
    effective_win_token_pct: number; // 代币胜率 (0-1)
    profit: number;                  // 总收益 (SOL计价)
    
    // 时间维度指标
    weight_hold_time: number;        // 加权代币持有时长(秒)
    weight_average_time: number;     // 加权代币清仓时长(秒)
}

// 聪明钱分类枚举
export enum SmartMoneyCategory {
    HIGH_WIN_RATE = "high_win_rate",        // 高胜率组
    HIGH_PROFIT_RATE = "high_profit_rate",  // 高收益率组
    WHALE_PROFIT = "whale_profit",          // 鲸鱼盈利组
    NORMAL = "normal"                       // 普通用户
}

// 聪明钱分析结果
export interface SmartMoneyAnalysisResult {
    metrics: SmartMoneyMetrics;
    category: SmartMoneyCategory;
    categoryScore: number;  // 分类置信度分数
}

// 代币持有信息
interface TokenHoldingInfo {
    tokenAddress: string;
    buyAmount: number;
    sellAmount: number;
    buyValue: number;        // SOL计价买入价值
    sellValue: number;       // SOL计价卖出价值
    unrealizedValue: number; // 未实现价值
    realizedProfit: number;  // 已实现利润
    unrealizedProfit: number; // 未实现利润
    totalBuyCost: number;    // 买入成本
    firstBuyTime: number;    // 首次买入时间
    lastSellTime: number;    // 最后卖出时间
    buyCount: number;        // 买入次数
    isCleared: boolean;      // 是否已清仓
    holdTime: number;        // 持有时长
}

// 快照数据结构
interface ParsedSnapshot {
    wallet_address: string;
    snapshot_time: string;
    total_buy_sol_amount: number;
    total_buy_usd_amount: number;
    total_sell_sol_amount: number;
    total_sell_usd_amount: number;
    buy_count: number;
    sell_count: number;
    sol_price: number;
    win_count: number;
    lose_count: number;
    current_token_value: any[];
}

// 聪明钱分析配置
interface SmartMoneyAnalysisConfig {
    ANALYSIS_PERIOD: number;      // 分析周期（天），固定为3天
    BASELINE_DAYS_AGO: number;    // 基准快照天数前（3天前）
    TWL: number;                  // Time Window Length 时间窗口长度
    MIN_TRANSACTION_COUNT: number; // 最低交易次数门槛
}

export class SmartMoneyAnalyzer {
    private readonly config: SmartMoneyAnalysisConfig = {
        ANALYSIS_PERIOD: 3,         // 分析周期3天
        BASELINE_DAYS_AGO: 3,       // 3天前作为基准
        TWL: 3,                     // 时间窗口长度为3
        MIN_TRANSACTION_COUNT: 5    // 最低交易次数
    };

    /**
     * 每日聪明钱分析主入口
     * 基于新策略：获取过去1天活跃地址，通过快照差值计算指标
     */
    async dailySmartMoneyAnalysis(): Promise<SmartMoneyAnalysisResult[]> {
        console.log("🧠 开始每日聪明钱分析（基于快照差值策略）...");
        
        try {
            // 1. 获取过去一天的活跃钱包地址（已排除聪明钱）
            const activeWallets = await this.getDailyActiveWallets();
            
            if (activeWallets.length === 0) {
                console.log("📭 没有找到需要分析的活跃钱包");
                return [];
            }

            console.log(`🔍 开始分析 ${activeWallets.length} 个活跃钱包...`);

            // 2. 并发获取快照数据：3天前 vs 最新
            const [baselineSnapshots, latestSnapshots] = await Promise.all([
                this.getSnapshotsBeforeDays(activeWallets, this.config.BASELINE_DAYS_AGO),
                this.getLatestSnapshots(activeWallets)
            ]);

            console.log(`📊 获取快照数据: 基准${baselineSnapshots.size}个, 最新${latestSnapshots.size}个`);

            // 3. 基于快照差值批量计算聪明钱指标
            const results = await this.batchAnalyzeBySnapshotDelta(
                activeWallets,
                baselineSnapshots,
                latestSnapshots
            );

            // 4. 输出分析结果
            const smartMoneyCount = results.filter(r => r.category !== SmartMoneyCategory.NORMAL).length;
            console.log(`🎯 分析完成: 共分析 ${results.length} 个钱包，发现 ${smartMoneyCount} 个聪明钱`);

            return results;

        } catch (error) {
            console.error("❌ 每日聪明钱分析失败:", error);
            return [];
        }
    }

    /**
     * 获取过去一天的活跃钱包地址（排除已知聪明钱）
     */
    private async getDailyActiveWallets(): Promise<string[]> {
        console.log("📋 获取过去一天的活跃钱包地址...");
        
        // 使用优化后的方法，内部已经排除了聪明钱地址
        return await SmartMoneyAddressService.getActiveWalletsExcludingSmartMoney(
            1, // 过去1天
            this.config.MIN_TRANSACTION_COUNT,
            2, // 最低买入次数
            1  // 最低代币种类
        );
    }

    /**
     * 获取指定天数前的快照数据
     */
    private async getSnapshotsBeforeDays(
        walletAddresses: string[], 
        daysAgo: number
    ): Promise<Map<string, ParsedSnapshot>> {
        return await SmartMoneyAddressService.getBaselineSnapshots(walletAddresses, daysAgo);
    }

    /**
     * 获取最新快照数据
     */
    private async getLatestSnapshots(
        walletAddresses: string[]
    ): Promise<Map<string, ParsedSnapshot>> {
        return await SmartMoneyAddressService.getLatestSnapshots(walletAddresses);
    }

    /**
     * 基于快照差值批量分析
     */
    private async batchAnalyzeBySnapshotDelta(
        walletAddresses: string[],
        baselineSnapshots: Map<string, any>,
        latestSnapshots: Map<string, any>
    ): Promise<SmartMoneyAnalysisResult[]> {
        const results: SmartMoneyAnalysisResult[] = [];
        const currentTime = Math.floor(Date.now() / 1000);
        const analysisStartTime = currentTime - (this.config.ANALYSIS_PERIOD * 24 * 60 * 60);

        console.log("🔢 开始基于快照差值的批量计算...");

        for (const walletAddress of walletAddresses) {
            const baselineSnapshot = baselineSnapshots.get(walletAddress);
            const latestSnapshot = latestSnapshots.get(walletAddress);

            // 必须有最新快照才能分析
            if (!latestSnapshot) {
                results.push(this.createEmptyResult(walletAddress, analysisStartTime, currentTime));
                continue;
            }

            // 解析快照数据
            const baseline = baselineSnapshot ? this.parseSnapshotData(baselineSnapshot) : null;
            const latest = this.parseSnapshotData(latestSnapshot);

            // 基于快照差值计算聪明钱指标
            const metrics = this.calculateMetricsBySnapshotDelta(
                walletAddress,
                baseline,
                latest,
                analysisStartTime,
                currentTime
            );

            // 聪明钱分类和评分
            const category = this.classifySmartMoney(metrics);
            const categoryScore = this.calculateCategoryScore(metrics, category);

            results.push({
                metrics,
                category,
                categoryScore
            });
        }

        return results;
    }

    /**
     * 核心方法：基于快照差值计算聪明钱指标
     */
    private calculateMetricsBySnapshotDelta(
        walletAddress: string,
        baseline: ParsedSnapshot | null,
        latest: ParsedSnapshot,
        analysisStartTime: number,
        analysisEndTime: number
    ): SmartMoneyMetrics {
        // 计算快照间的差值（这是关键）
        const deltaBuyCount = latest.buy_count - (baseline?.buy_count || 0);
        const deltaSellCount = latest.sell_count - (baseline?.sell_count || 0);
        const deltaWinCount = latest.win_count - (baseline?.win_count || 0);
        const deltaLoseCount = latest.lose_count - (baseline?.lose_count || 0);
        const deltaBuyVolume = latest.total_buy_sol_amount - (baseline?.total_buy_sol_amount || 0);
        const deltaSellVolume = latest.total_sell_sol_amount - (baseline?.total_sell_sol_amount || 0);

        // 分析当前持仓代币，计算财务指标
        let native_token_balance = 0;
        let wallet_balance = 0;
        const uniqueTokens = new Set<string>();
        let totalTokensWithActivity = 0;
        let winningTokens = 0;

        // 遍历当前持仓代币
        for (const tokenValue of latest.current_token_value) {
            if (tokenValue.transactions && tokenValue.transactions > 0) {
                uniqueTokens.add(tokenValue.tokenAddress);
                totalTokensWithActivity++;

                // 计算代币当前价值
                const tokenCurrentValue = (tokenValue.tokenBalance || 0) * (tokenValue.tokenSolPrice || 0);
                native_token_balance += tokenCurrentValue;
                wallet_balance += tokenCurrentValue;

                // 判断是否为获胜代币（根据策略文档）
                const totalBuyCost = (tokenValue.totalBuyAmount || 0) * (tokenValue.tokenWeightBuyPrice || 0);
                if (totalBuyCost > 0) {
                    const realizedValue = (tokenValue.totalSellAmount || 0) * (tokenValue.tokenWeightSellPrice || 0);
                    const unrealizedValue = tokenCurrentValue;
                    const totalProfit = realizedValue + unrealizedValue - totalBuyCost;
                    const profitRate = totalProfit / totalBuyCost;

                    // 策略条件：profit_rate > 0.1 AND total_profit > 0.5 SOL
                    if (profitRate > 0.1 && totalProfit > 0.5) {
                        winningTokens++;
                    }
                }
            }
        }

        // 计算核心指标（基于差值和TWL=3）
        const profit = deltaSellVolume - deltaBuyVolume; // 总收益
        const totalTransactions = deltaBuyCount + deltaSellCount;
        
        // 活跃天数比率：基于交易密度估算（TWL=3天）
        const active_days_present = Math.min(totalTransactions / (this.config.TWL * 3), 1);
        
        // 平均每种代币的购买次数
        const token_buy_counts = uniqueTokens.size > 0 ? deltaBuyCount / uniqueTokens.size : 0;
        
        // 代币胜率
        const effective_win_token_pct = totalTokensWithActivity > 0 ? winningTokens / totalTokensWithActivity : 0;
        
        // 时间维度指标（基于统计估算）
        const avgHoldTimeSeconds = 1.5 * 24 * 60 * 60; // 假设平均持有1.5天
        const weight_hold_time = avgHoldTimeSeconds;
        const weight_average_time = (deltaWinCount + deltaLoseCount) > 0 ? avgHoldTimeSeconds : 0;

        return {
            walletAddress,
            analysisStartTime,
            analysisEndTime,
            native_token_balance,
            wallet_balance,
            buy_token_count: uniqueTokens.size,
            active_days_present,
            token_buy_counts,
            effective_win_token_pct,
            profit,
            weight_hold_time,
            weight_average_time
        };
    }

    /**
     * 解析快照数据（从数据库行格式转换）
     */
    private parseSnapshotData(snapshotRow: any): ParsedSnapshot {
        if (!snapshotRow || !Array.isArray(snapshotRow)) {
            return {
                wallet_address: '',
                snapshot_time: '',
                total_buy_sol_amount: 0,
                total_buy_usd_amount: 0,
                total_sell_sol_amount: 0,
                total_sell_usd_amount: 0,
                buy_count: 0,
                sell_count: 0,
                sol_price: 0,
                win_count: 0,
                lose_count: 0,
                current_token_value: []
            };
        }

        // 根据wallet_trading_ss表结构解析（需要根据实际表结构调整索引）
        return {
            wallet_address: snapshotRow[1] || '',
            snapshot_time: snapshotRow[2] || '',
            total_buy_sol_amount: Number(snapshotRow[4]) || 0,
            total_buy_usd_amount: Number(snapshotRow[5]) || 0,
            total_sell_sol_amount: Number(snapshotRow[6]) || 0,
            total_sell_usd_amount: Number(snapshotRow[7]) || 0,
            buy_count: Number(snapshotRow[8]) || 0,
            sell_count: Number(snapshotRow[9]) || 0,
            sol_price: Number(snapshotRow[10]) || 0,
            win_count: Number(snapshotRow[11]) || 0,
            lose_count: Number(snapshotRow[12]) || 0,
            current_token_value: JSON.parse(snapshotRow[13] || '[]')
        };
    }

    /**
     * 聪明钱分类（使用TWL=3）
     */
    protected classifySmartMoney(metrics: SmartMoneyMetrics): SmartMoneyCategory {
        const TWL = this.config.TWL; // 3

        // 高胜率组条件
        const isHighWinRate = (
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) &&
            metrics.profit > 0.025 * TWL &&  // 0.075 SOL
            metrics.effective_win_token_pct > 0.6 &&
            metrics.token_buy_counts > 0.3 * TWL &&  // 0.9
            metrics.active_days_present > 0.3 * TWL  // 0.9 (实际是0.3，因为比率)
        );

        // 高收益率组条件
        const isHighProfitRate = (
            metrics.profit > 0.7 * TWL &&  // 2.1 SOL
            metrics.effective_win_token_pct > 0.5 &&
            (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) &&
            metrics.token_buy_counts > 0.1 * TWL &&  // 0.3
            metrics.active_days_present > 0.3 * TWL  // 0.9 (实际是0.3)
        );

        // 鲸鱼盈利组条件
        const isWhaleProfit = (
            (metrics.native_token_balance > 1000 || metrics.wallet_balance > 2000) &&
            metrics.effective_win_token_pct > 0.3 &&
            metrics.token_buy_counts > 0.1 * TWL &&  // 0.3
            metrics.active_days_present > 0.3 * TWL  // 0.9 (实际是0.3)
        );

        // 优先级排序：鲸鱼 > 高收益率 > 高胜率 > 普通
        if (isWhaleProfit) return SmartMoneyCategory.WHALE_PROFIT;
        if (isHighProfitRate) return SmartMoneyCategory.HIGH_PROFIT_RATE;
        if (isHighWinRate) return SmartMoneyCategory.HIGH_WIN_RATE;
        
        return SmartMoneyCategory.NORMAL;
    }

    /**
     * 计算分类置信度分数（使用TWL=3）
     */
    protected calculateCategoryScore(metrics: SmartMoneyMetrics, category: SmartMoneyCategory): number {
        const TWL = this.config.TWL; // 3
        let score = 0;

        switch (category) {
            case SmartMoneyCategory.HIGH_WIN_RATE:
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.profit / (0.025 * TWL), 2) * 20;
                score += Math.min(metrics.effective_win_token_pct / 0.6, 1) * 20;
                score += Math.min(metrics.token_buy_counts / (0.3 * TWL), 1) * 20;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 20;
                break;

            case SmartMoneyCategory.HIGH_PROFIT_RATE:
                score += Math.min(metrics.profit / (0.7 * TWL), 2) * 30;
                score += Math.min(metrics.effective_win_token_pct / 0.5, 1) * 25;
                score += (metrics.native_token_balance > 0.5 || metrics.wallet_balance > 1) ? 20 : 0;
                score += Math.min(metrics.token_buy_counts / (0.1 * TWL), 1) * 15;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 10;
                break;

            case SmartMoneyCategory.WHALE_PROFIT:
                score += (metrics.native_token_balance > 1000 || metrics.wallet_balance > 2000) ? 40 : 0;
                score += Math.min(metrics.effective_win_token_pct / 0.3, 1) * 30;
                score += Math.min(metrics.token_buy_counts / (0.1 * TWL), 1) * 15;
                score += Math.min(metrics.active_days_present / (0.3 * TWL), 1) * 15;
                break;

            default:
                score = 0;
        }

        return Math.min(score, 100);
    }

    /**
     * 创建空结果
     */
    private createEmptyResult(
        walletAddress: string, 
        analysisStartTime: number, 
        analysisEndTime: number
    ): SmartMoneyAnalysisResult {
        return {
            metrics: {
                walletAddress,
                analysisStartTime,
                analysisEndTime,
                native_token_balance: 0,
                wallet_balance: 0,
                buy_token_count: 0,
                active_days_present: 0,
                token_buy_counts: 0,
                effective_win_token_pct: 0,
                profit: 0,
                weight_hold_time: 0,
                weight_average_time: 0
            },
            category: SmartMoneyCategory.NORMAL,
            categoryScore: 0
        };
    }

    // 向后兼容方法保持不变...
    async getActiveWalletsForAnalysis(endTime?: number): Promise<string[]> {
        return await this.getDailyActiveWallets();
    }

    async analyzeActiveWallets(endTime?: number): Promise<SmartMoneyAnalysisResult[]> {
        return await this.dailySmartMoneyAnalysis();
    }

    async analyzeWallet(walletAddress: string, endTime?: number): Promise<SmartMoneyAnalysisResult> {
        const analysisEndTime = endTime || Math.floor(Date.now() / 1000);
        const analysisStartTime = analysisEndTime - (this.config.ANALYSIS_PERIOD * 24 * 60 * 60);

        try {
            const [baselineSnapshots, latestSnapshots] = await Promise.all([
                SmartMoneyAddressService.getBaselineSnapshots([walletAddress], this.config.BASELINE_DAYS_AGO),
                SmartMoneyAddressService.getLatestSnapshots([walletAddress])
            ]);

            const baseline = baselineSnapshots.get(walletAddress);
            const latest = latestSnapshots.get(walletAddress);

            if (!latest) {
                return this.createEmptyResult(walletAddress, analysisStartTime, analysisEndTime);
            }

            const baselineParsed = baseline ? this.parseSnapshotData(baseline) : null;
            const latestParsed = this.parseSnapshotData(latest);

            const metrics = this.calculateMetricsBySnapshotDelta(
                walletAddress,
                baselineParsed,
                latestParsed,
                analysisStartTime,
                analysisEndTime
            );

            const category = this.classifySmartMoney(metrics);
            const categoryScore = this.calculateCategoryScore(metrics, category);

            return { metrics, category, categoryScore };

        } catch (error) {
            console.warn(`Failed to analyze wallet ${walletAddress}:`, error);
            return this.createEmptyResult(walletAddress, analysisStartTime, analysisEndTime);
        }
    }

    async analyzeWallets(walletAddresses: string[], endTime?: number): Promise<SmartMoneyAnalysisResult[]> {
        if (walletAddresses.length === 0) return [];

        try {
            const [baselineSnapshots, latestSnapshots] = await Promise.all([
                SmartMoneyAddressService.getBaselineSnapshots(walletAddresses, this.config.BASELINE_DAYS_AGO),
                SmartMoneyAddressService.getLatestSnapshots(walletAddresses)
            ]);

            return await this.batchAnalyzeBySnapshotDelta(
                walletAddresses,
                baselineSnapshots,
                latestSnapshots
            );

        } catch (error) {
            console.error("Batch analysis failed:", error);
            return [];
        }
    }

    getSmartMoneyStats(results: SmartMoneyAnalysisResult[]): {
        total: number;
        byCategory: Record<SmartMoneyCategory, number>;
        avgMetrics: SmartMoneyMetrics;
    } {
        const stats = {
            total: results.length,
            byCategory: {
                [SmartMoneyCategory.HIGH_WIN_RATE]: 0,
                [SmartMoneyCategory.HIGH_PROFIT_RATE]: 0,
                [SmartMoneyCategory.WHALE_PROFIT]: 0,
                [SmartMoneyCategory.NORMAL]: 0
            },
            avgMetrics: {} as SmartMoneyMetrics
        };

        for (const result of results) {
            stats.byCategory[result.category]++;
        }

        if (results.length > 0) {
            const sumMetrics = results.reduce((sum, result) => {
                sum.native_token_balance += result.metrics.native_token_balance;
                sum.wallet_balance += result.metrics.wallet_balance;
                sum.buy_token_count += result.metrics.buy_token_count;
                sum.active_days_present += result.metrics.active_days_present;
                sum.token_buy_counts += result.metrics.token_buy_counts;
                sum.effective_win_token_pct += result.metrics.effective_win_token_pct;
                sum.profit += result.metrics.profit;
                sum.weight_hold_time += result.metrics.weight_hold_time;
                sum.weight_average_time += result.metrics.weight_average_time;
                return sum;
            }, {
                native_token_balance: 0,
                wallet_balance: 0,
                buy_token_count: 0,
                active_days_present: 0,
                token_buy_counts: 0,
                effective_win_token_pct: 0,
                profit: 0,
                weight_hold_time: 0,
                weight_average_time: 0
            });

            const count = results.length;
            stats.avgMetrics = {
                walletAddress: "average",
                analysisStartTime: 0,
                analysisEndTime: 0,
                native_token_balance: sumMetrics.native_token_balance / count,
                wallet_balance: sumMetrics.wallet_balance / count,
                buy_token_count: sumMetrics.buy_token_count / count,
                active_days_present: sumMetrics.active_days_present / count,
                token_buy_counts: sumMetrics.token_buy_counts / count,
                effective_win_token_pct: sumMetrics.effective_win_token_pct / count,
                profit: sumMetrics.profit / count,
                weight_hold_time: sumMetrics.weight_hold_time / count,
                weight_average_time: sumMetrics.weight_average_time / count
            };
        }

        return stats;
    }
}
