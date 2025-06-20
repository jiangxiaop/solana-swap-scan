#!/usr/bin/env -S deno run --allow-all

import { SnapShotForWalletTrading } from "../type/transaction.ts";

// Mock数据生成配置
interface MockDataConfig {
    totalWallets: number;          // 总钱包数量
    highWinRateRatio: number;      // 高胜率钱包比例
    highProfitRateRatio: number;   // 高收益钱包比例
    whaleProfitRatio: number;      // 鲸鱼钱包比例
    timeSpanDays: number;          // 时间跨度（天）
    avgTokensPerWallet: number;    // 每个钱包平均代币数
    avgTransactionsPerToken: number; // 每个代币平均交易次数
}

// 默认配置
const DEFAULT_CONFIG: MockDataConfig = {
    totalWallets: 5000,           // 生成5000个钱包
    highWinRateRatio: 0.05,       // 5%高胜率
    highProfitRateRatio: 0.03,    // 3%高收益
    whaleProfitRatio: 0.01,       // 1%鲸鱼
    timeSpanDays: 30,             // 30天数据
    avgTokensPerWallet: 3,        // 每钱包平均3个代币
    avgTransactionsPerToken: 5,   // 每代币平均5次交易
};

// 钱包类型枚举
enum WalletType {
    HIGH_WIN_RATE = "high_win_rate",
    HIGH_PROFIT_RATE = "high_profit_rate", 
    WHALE_PROFIT = "whale_profit",
    NORMAL = "normal"
}

class MockWalletDataGenerator {
    private config: MockDataConfig;
    private solPrice: number = 145.16; // 固定SOL价格
    
    // 预定义的代币池
    private tokenPool = [
        "12jagQJNhCdvGvmU5XGbud5o57mi926nGT1A7pM6wAZG",
        "2bPAMiZzmopwgD2eJq8RYwpvQRC9Uh5Q8CdndNaQpump", 
        "2ZGE82qFQZvBtcm1F4fkeKZwrjK28HFTCoJtmcqaQSaS",
        "2Wu1g2ft7qZHfTpfzP3wLdfPeV1is4EwQ3CXBfRYAciD",
        "2QaiMndNsdkpfUgTVrRWaEqxKdBkNRMevt8qc29Wpump",
        "3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE",
        "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
        "6dJp6Bks2bKpjNF4nXjKEJrFfFnZ6W9qUm8RGKVRm4k5",
        "7dHbWXmci3dT1UFgWiQFgkG5gG7D5YGBxKGnRdKdRo8G",
        "8ehTXNE9Qz8N7kEY4V6CgR5F2D6r9R5oP6qPgD6d6d6d",
        "9fRgBVAL3kf2NzL8R8d6R6D9ZcF5F2N9xkF6R8D6R6D6",
        "BgZ6R8D6r6D9ZcF5F2N9xkF6R8D6R6D6F2r8D6R6D9Zc",
        "ChF5F2N9xkF6R8D6R6D6F2r8D6R6D9ZcF5F2N9xkF6R8",
        "DkF6R8D6R6D6F2r8D6R6D9ZcF5F2N9xkF6R8D6R6D6F2",
        "EF2N9xkF6R8D6R6D6F2r8D6R6D9ZcF5F2N9xkF6R8D6",
        "F6R8D6R6D6F2r8D6R6D9ZcF5F2N9xkF6R8D6R6D6F2r8",
        "GD6R6D9ZcF5F2N9xkF6R8D6R6D6F2r8D6R6D9ZcF5F2",
        "H9xkF6R8D6R6D6F2r8D6R6D9ZcF5F2N9xkF6R8D6R6D6",
        "IF2r8D6R6D9ZcF5F2N9xkF6R8D6R6D6F2r8D6R6D9Zc"
    ];

    constructor(config: Partial<MockDataConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 生成随机钱包地址
     */
    private generateWalletAddress(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
        let result = '';
        for (let i = 0; i < 44; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 生成随机时间戳（过去N天内）
     */
    private generateRandomTimestamp(daysAgo: number = 30): string {
        const now = Math.floor(Date.now() / 1000);
        const secondsInDay = 24 * 60 * 60;
        const randomOffset = Math.floor(Math.random() * daysAgo * secondsInDay);
        return (now - randomOffset).toString();
    }

    /**
     * 生成随机代币价格
     */
    private generateTokenPrice(type: WalletType, isProfitable: boolean = false): { solPrice: number; usdPrice: number } {
        let basePrice: number;
        
        switch (type) {
            case WalletType.WHALE_PROFIT:
                // 鲸鱼更喜欢高价值代币
                basePrice = 0.1 + Math.random() * 10;
                break;
            case WalletType.HIGH_PROFIT_RATE:
                // 高收益率组购买的代币价格变化大
                basePrice = 0.001 + Math.random() * 1;
                break;
            default:
                // 普通代币价格
                basePrice = 0.0001 + Math.random() * 0.1;
        }

        // 如果需要盈利，增加价格波动
        if (isProfitable) {
            basePrice *= (1.2 + Math.random() * 2); // 增加20%-320%
        }

        return {
            solPrice: basePrice,
            usdPrice: basePrice * this.solPrice
        };
    }

    /**
     * 生成代币交易数据
     */
    private generateTokenTransaction(
        tokenAddress: string, 
        walletType: WalletType, 
        isBuy: boolean,
        isProfitable: boolean = false
    ) {
        const price = this.generateTokenPrice(walletType, isProfitable);
        
        // 根据钱包类型调整交易量
        let baseAmount: number;
        switch (walletType) {
            case WalletType.WHALE_PROFIT:
                baseAmount = 10000 + Math.random() * 100000; // 大额交易
                break;
            case WalletType.HIGH_PROFIT_RATE:
                baseAmount = 1000 + Math.random() * 10000;
                break;
            case WalletType.HIGH_WIN_RATE:
                baseAmount = 500 + Math.random() * 5000;
                break;
            default:
                baseAmount = 10 + Math.random() * 1000;
        }

        const tradeAmount = baseAmount;
        const tradeSolAmount = tradeAmount * price.solPrice;
        const tradeUsdAmount = tradeSolAmount * this.solPrice;

        return {
            tokenAddress,
            tradeAmount,
            tokenPrice: price.solPrice,
            tokenUsdPrice: price.usdPrice,
            tradeSolAmount,
            tradeUsdAmount,
            isBuy
        };
    }

    /**
     * 生成代币持仓数据
     */
    private generateTokenValue(
        tokenAddress: string,
        walletType: WalletType,
        totalBuyAmount: number,
        totalSellAmount: number,
        transactions: number,
        isCleared: boolean = false,
        isProfitable: boolean = false
    ) {
        const buyPrice = this.generateTokenPrice(walletType);
        const sellPrice = isProfitable 
            ? { solPrice: buyPrice.solPrice * (1.2 + Math.random()), usdPrice: buyPrice.usdPrice * (1.2 + Math.random()) }
            : { solPrice: buyPrice.solPrice * (0.5 + Math.random() * 0.5), usdPrice: buyPrice.usdPrice * (0.5 + Math.random() * 0.5) };

        const tokenBalance = totalBuyAmount - totalSellAmount;
        const currentPrice = isCleared ? sellPrice : buyPrice;

        const result: any = {
            tokenAddress,
            tokenBalance,
            tokenSolPrice: currentPrice.solPrice,
            tokenUsdPrice: currentPrice.usdPrice,
            tokenWeightBuyPrice: totalBuyAmount > 0 ? buyPrice.solPrice : 0,
            tokenWeightBuyUsdPrice: totalBuyAmount > 0 ? buyPrice.usdPrice : 0,
            tokenWeightSellPrice: totalSellAmount > 0 ? sellPrice.solPrice : 0,
            tokenWeightSellUsdPrice: totalSellAmount > 0 ? sellPrice.usdPrice : 0,
            totalBuyAmount,
            totalSellAmount,
            transactions,
            isCleared,
            clearanceHistory: []
        };

        // 如果已清仓，添加清仓历史
        if (isCleared && totalSellAmount > 0) {
            const pnlSol = totalSellAmount * sellPrice.solPrice - totalBuyAmount * buyPrice.solPrice;
            const pnlUsd = pnlSol * this.solPrice;
            
            result.clearanceHistory.push({
                clearanceTime: this.generateRandomTimestamp(7), // 最近7天清仓
                totalBuyAmount,
                totalSellAmount,
                avgBuyPrice: buyPrice.solPrice,
                avgBuyUsdPrice: buyPrice.usdPrice,
                avgSellPrice: sellPrice.solPrice,
                avgSellUsdPrice: sellPrice.usdPrice,
                transactions,
                isProfit: pnlSol > 0,
                pnlSol,
                pnlUsd
            });
        }

        return result;
    }

    /**
     * 生成特定类型的钱包数据
     */
    private generateWalletSnapshot(walletType: WalletType): SnapShotForWalletTrading {
        const walletAddress = this.generateWalletAddress();
        const snapshotTime = this.generateRandomTimestamp(this.config.timeSpanDays);
        
        // 根据钱包类型调整参数
        let tokenCount: number;
        let winRatio: number;
        let isWhale: boolean = false;

        switch (walletType) {
            case WalletType.HIGH_WIN_RATE:
                tokenCount = 2 + Math.floor(Math.random() * 5); // 2-6个代币
                winRatio = 0.7 + Math.random() * 0.3;           // 70%-100%胜率
                break;
            case WalletType.HIGH_PROFIT_RATE:
                tokenCount = 3 + Math.floor(Math.random() * 7); // 3-9个代币
                winRatio = 0.6 + Math.random() * 0.3;           // 60%-90%胜率
                break;
            case WalletType.WHALE_PROFIT:
                tokenCount = 5 + Math.floor(Math.random() * 10); // 5-14个代币
                winRatio = 0.4 + Math.random() * 0.4;            // 40%-80%胜率
                isWhale = true;
                break;
            default:
                tokenCount = 1 + Math.floor(Math.random() * 3);  // 1-3个代币
                winRatio = Math.random() * 0.6;                  // 0%-60%胜率
        }

        const perTLTradingValue: any[] = [];
        const currentTokenValue: any[] = [];
        
        let totalBuySolAmount = 0;
        let totalBuyUsdAmount = 0;
        let totalSellSolAmount = 0;
        let totalSellUsdAmount = 0;
        let buyCount = 0;
        let sellCount = 0;
        let winCount = 0;
        let loseCount = 0;

        // 为每个代币生成交易数据
        for (let i = 0; i < tokenCount; i++) {
            const tokenAddress = this.tokenPool[Math.floor(Math.random() * this.tokenPool.length)];
            const transactionCount = 1 + Math.floor(Math.random() * this.config.avgTransactionsPerToken);
            
            let tokenBuyAmount = 0;
            let tokenSellAmount = 0;
            const isWinningToken = Math.random() < winRatio;
            
            // 生成买入交易
            const buyTransactions = Math.ceil(transactionCount * 0.6); // 60%是买入
            for (let j = 0; j < buyTransactions; j++) {
                const buyTx = this.generateTokenTransaction(tokenAddress, walletType, true, isWinningToken);
                perTLTradingValue.push(buyTx);
                
                tokenBuyAmount += buyTx.tradeAmount;
                totalBuySolAmount += buyTx.tradeSolAmount;
                totalBuyUsdAmount += buyTx.tradeUsdAmount;
                buyCount++;
            }

            // 生成卖出交易（部分代币）
            const shouldSell = Math.random() < 0.7; // 70%的代币会有卖出
            if (shouldSell && tokenBuyAmount > 0) {
                const sellRatio = isWinningToken ? 0.3 + Math.random() * 0.7 : 0.1 + Math.random() * 0.5;
                tokenSellAmount = tokenBuyAmount * sellRatio;
                
                const sellTx = this.generateTokenTransaction(tokenAddress, walletType, false, isWinningToken);
                sellTx.tradeAmount = tokenSellAmount;
                sellTx.tradeSolAmount = tokenSellAmount * sellTx.tokenPrice;
                sellTx.tradeUsdAmount = sellTx.tradeSolAmount * this.solPrice;
                
                perTLTradingValue.push(sellTx);
                
                totalSellSolAmount += sellTx.tradeSolAmount;
                totalSellUsdAmount += sellTx.tradeUsdAmount;
                sellCount++;
            }

            // 统计盈亏
            if (tokenSellAmount > 0) {
                if (isWinningToken) {
                    winCount++;
                } else {
                    loseCount++;
                }
            }

            // 生成代币持仓数据
            const isCleared = tokenSellAmount >= tokenBuyAmount * 0.95; // 95%以上卖出算清仓
            const tokenValue = this.generateTokenValue(
                tokenAddress,
                walletType,
                tokenBuyAmount,
                tokenSellAmount,
                transactionCount,
                isCleared,
                isWinningToken
            );
            
            currentTokenValue.push(tokenValue);
        }

        // 鲸鱼钱包调整交易额
        if (isWhale) {
            totalBuySolAmount *= (10 + Math.random() * 100);  // 10-110倍
            totalBuyUsdAmount *= (10 + Math.random() * 100);
            totalSellSolAmount *= (10 + Math.random() * 100);
            totalSellUsdAmount *= (10 + Math.random() * 100);
        }

        return {
            walletAddress,
            snapshotTime,
            perTLTradingValue,
            totalBuySolAmount,
            totalBuyUsdAmount,
            totalSellSolAmount,
            totalSellUsdAmount,
            buy_count: buyCount,
            sell_count: sellCount,
            solPrice: this.solPrice,
            winCount,
            loseCount,
            currentTokenValue
        };
    }

    /**
     * 生成指定数量的钱包快照数据
     */
    generateWalletSnapshots(): SnapShotForWalletTrading[] {
        const snapshots: SnapShotForWalletTrading[] = [];
        
        const highWinRateCount = Math.floor(this.config.totalWallets * this.config.highWinRateRatio);
        const highProfitRateCount = Math.floor(this.config.totalWallets * this.config.highProfitRateRatio);
        const whaleProfitCount = Math.floor(this.config.totalWallets * this.config.whaleProfitRatio);
        const normalCount = this.config.totalWallets - highWinRateCount - highProfitRateCount - whaleProfitCount;

        console.log(`🎯 生成钱包分布:`);
        console.log(`  🥇 高胜率组: ${highWinRateCount} 个`);
        console.log(`  💰 高收益组: ${highProfitRateCount} 个`);
        console.log(`  🐋 鲸鱼组: ${whaleProfitCount} 个`);
        console.log(`  📊 普通用户: ${normalCount} 个`);
        console.log(`  📈 总计: ${this.config.totalWallets} 个钱包\n`);

        // 生成高胜率钱包
        for (let i = 0; i < highWinRateCount; i++) {
            snapshots.push(this.generateWalletSnapshot(WalletType.HIGH_WIN_RATE));
            if ((i + 1) % 100 === 0) {
                console.log(`✅ 已生成 ${i + 1}/${highWinRateCount} 个高胜率钱包`);
            }
        }

        // 生成高收益钱包
        for (let i = 0; i < highProfitRateCount; i++) {
            snapshots.push(this.generateWalletSnapshot(WalletType.HIGH_PROFIT_RATE));
            if ((i + 1) % 100 === 0) {
                console.log(`💰 已生成 ${i + 1}/${highProfitRateCount} 个高收益钱包`);
            }
        }

        // 生成鲸鱼钱包
        for (let i = 0; i < whaleProfitCount; i++) {
            snapshots.push(this.generateWalletSnapshot(WalletType.WHALE_PROFIT));
            if ((i + 1) % 10 === 0) {
                console.log(`🐋 已生成 ${i + 1}/${whaleProfitCount} 个鲸鱼钱包`);
            }
        }

        // 生成普通钱包
        for (let i = 0; i < normalCount; i++) {
            snapshots.push(this.generateWalletSnapshot(WalletType.NORMAL));
            if ((i + 1) % 500 === 0) {
                console.log(`📊 已生成 ${i + 1}/${normalCount} 个普通钱包`);
            }
        }

        console.log(`\n🎉 成功生成 ${snapshots.length} 个钱包快照数据！`);
        return snapshots;
    }

    /**
     * 保存钱包快照数据到文件
     */
    async saveToFile(snapshots: SnapShotForWalletTrading[], filename: string = "large_wallet_trading_snapshots.json"): Promise<void> {
        const MOCK_DATA_DIR = "./test_data_for_smart_money";
        
        // 确保目录存在
        await Deno.mkdir(MOCK_DATA_DIR, { recursive: true });

        const filepath = `${MOCK_DATA_DIR}/${filename}`;

        // 计算统计信息
        const uniqueWallets = new Set(snapshots.map(s => s.walletAddress)).size;
        const totalTokens = snapshots.reduce((sum, s) => sum + s.currentTokenValue.length, 0);
        const uniqueTokens = new Set(snapshots.flatMap(s => s.currentTokenValue.map(t => t.tokenAddress))).size;
        const totalBuyTransactions = snapshots.reduce((sum, s) => sum + s.buy_count, 0);
        const totalSellTransactions = snapshots.reduce((sum, s) => sum + s.sell_count, 0);
        const totalBuyVolume = snapshots.reduce((sum, s) => sum + s.totalBuySolAmount, 0);
        const totalSellVolume = snapshots.reduce((sum, s) => sum + s.totalSellSolAmount, 0);

        const dataToSave = {
            type: "large_wallet_trading_snapshots",
            timestamp: new Date().toISOString(),
            config: this.config,
            count: snapshots.length,
            statistics: {
                uniqueWallets,
                totalTokens,
                uniqueTokens,
                totalBuyTransactions,
                totalSellTransactions,
                totalBuyVolume,
                totalSellVolume,
                avgTokensPerWallet: totalTokens / uniqueWallets,
                avgBuyVolumePerWallet: totalBuyVolume / uniqueWallets,
                avgSellVolumePerWallet: totalSellVolume / uniqueWallets
            },
            data: snapshots
        };

        await Deno.writeTextFile(filepath, JSON.stringify(dataToSave, null, 2));
        
        const fileSize = (await Deno.stat(filepath)).size;
        console.log(`\n💾 数据已保存到: ${filepath}`);
        console.log(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`\n📈 数据统计:`);
        console.log(`  🏦 ${uniqueWallets} 个唯一钱包`);
        console.log(`  🪙 ${uniqueTokens} 个唯一代币`);
        console.log(`  📈 ${totalBuyTransactions} 次买入交易`);
        console.log(`  📉 ${totalSellTransactions} 次卖出交易`);
        console.log(`  💰 ${totalBuyVolume.toFixed(2)} SOL 买入总量`);
        console.log(`  💸 ${totalSellVolume.toFixed(2)} SOL 卖出总量`);
    }
}

// 主函数
async function main() {
    console.log("🚀 开始生成大量Mock钱包交易快照数据...\n");

    // 可以通过命令行参数自定义配置
    const args = Deno.args;
    const config: Partial<MockDataConfig> = {};
    
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.replace('--', '');
        const value = args[i + 1];
        if (key && value) {
            switch (key) {
                case 'totalWallets':
                    config.totalWallets = parseInt(value);
                    break;
                case 'highWinRateRatio':
                    config.highWinRateRatio = parseFloat(value);
                    break;
                case 'highProfitRateRatio':
                    config.highProfitRateRatio = parseFloat(value);
                    break;
                case 'whaleProfitRatio':
                    config.whaleProfitRatio = parseFloat(value);
                    break;
                case 'timeSpanDays':
                    config.timeSpanDays = parseInt(value);
                    break;
            }
        }
    }

    const generator = new MockWalletDataGenerator(config);
    const snapshots = generator.generateWalletSnapshots();
    await generator.saveToFile(snapshots);

    console.log("\n✅ Mock数据生成完成！");
    console.log("\n📝 使用方法:");
    console.log("1. 运行聪明钱算法测试:");
    console.log("   deno test --allow-all --no-check src/smart-money/index.test.ts");
    console.log("\n2. 自定义参数生成:");
    console.log("   deno run --allow-all src/smart-money/mock-data-generator.ts --totalWallets 10000 --highWinRateRatio 0.1");
}

// 如果直接运行此文件，执行main函数
if (import.meta.main) {
    main().catch(console.error);
}

export { MockWalletDataGenerator, DEFAULT_CONFIG, type MockDataConfig }; 