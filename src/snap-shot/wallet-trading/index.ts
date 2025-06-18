import { SnapShotForWalletTrading } from "../../type/transaction.ts";
import { SwapTransactionToken, TokenSwapFilterData } from "../../type/swap.ts";
import { TOKENS } from "../../constant/token.ts";
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler.ts";

interface SnapshotWalletTradingFilterData {
    [walletAddress: string]: SnapShotForWalletTrading
}

// 创建一个服务对象，使函数可以被 stub
export const walletTradingService = {
    async initWalletTrading(
        userAddress: string,
        snapshotTime: string,
        timeWindow: number
    ): Promise<SnapShotForWalletTrading[]> {
        const userPerSnapshot = await getPreWindowSnapshot(userAddress, snapshotTime, timeWindow);
        return userPerSnapshot;
    }
};

// 保持原有的导出函数，但内部调用服务对象
export const initWalletTrading = async (
    userAddress: string,
    snapshotTime: string,
    timeWindow: number
): Promise<SnapShotForWalletTrading[]> => {
    return walletTradingService.initWalletTrading(userAddress, snapshotTime, timeWindow);
}

export const snapshotWalletTradingByTxData = async (txs: TokenSwapFilterData[]): Promise<SnapShotForWalletTrading[]> => {
    const result: SnapshotWalletTradingFilterData = {};

    for (const tx of txs) {
        const walletAddress = tx.userAddress;

        // 如果这个钱包地址还没有处理过，则初始化
        if (!result[walletAddress]) {
            const walletTradingArray = await walletTradingService.initWalletTrading(walletAddress, tx.transactionTime, 0);
            // 取数组的第一个元素作为钱包交易数据，并进行深拷贝以避免引用共享
            const baseData = walletTradingArray[0];
            result[walletAddress] = baseData ? {
                ...baseData,
                walletAddress: walletAddress,
                snapshotTime: tx.transactionTime,
                perTLTradingValue: [], // 重置为空数组，只包含当前批次的交易
                currentTokenValue: baseData.currentTokenValue ? [...baseData.currentTokenValue.map(item => ({ ...item }))] : []
            } : {
                walletAddress: walletAddress,
                snapshotTime: tx.transactionTime,
                perTLTradingValue: [],
                totalBuySolAmount: 0,
                totalBuyUsdAmount: 0,
                totalSellSolAmount: 0,
                totalSellUsdAmount: 0,
                buy_count: 0,
                sell_count: 0,
                solPrice: 0,
                winCount: 0,
                loseCount: 0,
                currentTokenValue: [],
            };
        }

        const walletTrading = result[walletAddress];

        // 更新快照时间为当前交易时间
        walletTrading.snapshotTime = tx.transactionTime;
        walletTrading.solPrice = tx.usdPrice / tx.quotePrice; // SOL的USD价格

        if (tx.quoteAddress !== TOKENS.SOL && tx.quoteAddress !== TOKENS.USDC && tx.quoteAddress !== TOKENS.USDT) {
            continue;
        }

        // 添加单笔交易到 perTLTradingValue（只包含当前批次的交易）
        walletTrading.perTLTradingValue.push({
            tokenAddress: tx.tokenAddress,
            tradeAmount: tx.tokenAmount,
            tokenPrice: tx.quotePrice,
            tokenUsdPrice: tx.usdPrice,
            tradeSolAmount: tx.quoteAmount,
            tradeUsdAmount: tx.usdAmount,
            isBuy: tx.isBuy,
        });

        // 更新买卖总金额和计数（累加历史数据）
        if (tx.isBuy) {
            walletTrading.totalBuySolAmount += tx.quoteAmount;
            walletTrading.totalBuyUsdAmount += tx.usdAmount;
            walletTrading.buy_count += 1;
        } else {
            walletTrading.totalSellSolAmount += tx.quoteAmount;
            walletTrading.totalSellUsdAmount += tx.usdAmount;
            walletTrading.sell_count += 1;
        }

        // 更新或创建 currentTokenValue 中的代币信息
        let tokenValueIndex = walletTrading.currentTokenValue.findIndex(
            item => item.tokenAddress === tx.tokenAddress
        );

        if (tokenValueIndex === -1) {
            // 创建新的代币记录
            walletTrading.currentTokenValue.push({
                tokenAddress: tx.tokenAddress,
                tokenBalance: 0,
                tokenSolPrice: tx.quotePrice,
                tokenUsdPrice: tx.usdPrice,
                tokenWeightBuyPrice: 0,
                tokenWeightBuyUsdPrice: 0,
                tokenWeightSellPrice: 0,
                tokenWeightSellUsdPrice: 0,
                totalBuyAmount: 0,
                totalSellAmount: 0,
                transactions: 0,
            });
            tokenValueIndex = walletTrading.currentTokenValue.length - 1;
        }

        const tokenValue = walletTrading.currentTokenValue[tokenValueIndex];

        // 更新代币当前价格
        tokenValue.tokenSolPrice = tx.quotePrice;
        tokenValue.tokenUsdPrice = tx.usdPrice;
        tokenValue.transactions += 1;

        if (tx.isBuy) {
            // 买入操作 - 计算加权平均买入价格
            const prevTotalBuyAmount = tokenValue.totalBuyAmount;
            const prevTotalBuyCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyPrice;
            const prevTotalBuyUsdCost = prevTotalBuyAmount * tokenValue.tokenWeightBuyUsdPrice;

            const newTotalBuyAmount = prevTotalBuyAmount + tx.tokenAmount;
            const newTotalBuyCost = prevTotalBuyCost + tx.tokenAmount * tx.quotePrice;
            const newTotalBuyUsdCost = prevTotalBuyUsdCost + tx.tokenAmount * tx.usdPrice;

            tokenValue.totalBuyAmount = newTotalBuyAmount;
            tokenValue.tokenBalance += tx.tokenAmount;

            // 计算加权平均买入价格
            if (newTotalBuyAmount > 0) {
                tokenValue.tokenWeightBuyPrice = newTotalBuyCost / newTotalBuyAmount;
                tokenValue.tokenWeightBuyUsdPrice = newTotalBuyUsdCost / newTotalBuyAmount;
            }
        } else {
            // 卖出操作 - 计算加权平均卖出价格
            const prevTotalSellAmount = tokenValue.totalSellAmount;
            const prevTotalSellRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellPrice;
            const prevTotalSellUsdRevenue = prevTotalSellAmount * tokenValue.tokenWeightSellUsdPrice;

            const newTotalSellAmount = prevTotalSellAmount + tx.tokenAmount;
            const newTotalSellRevenue = prevTotalSellRevenue + tx.tokenAmount * tx.quotePrice;
            const newTotalSellUsdRevenue = prevTotalSellUsdRevenue + tx.tokenAmount * tx.usdPrice;

            tokenValue.totalSellAmount = newTotalSellAmount;
            tokenValue.tokenBalance -= tx.tokenAmount;

            // 计算加权平均卖出价格
            if (newTotalSellAmount > 0) {
                tokenValue.tokenWeightSellPrice = newTotalSellRevenue / newTotalSellAmount;
                tokenValue.tokenWeightSellUsdPrice = newTotalSellUsdRevenue / newTotalSellAmount;
            }
        }
    }

    const resultSnapShot: SnapShotForWalletTrading[] = [];

    for (const walletAddress in result) {
        const walletTrading = result[walletAddress];

        // 检查是否有代币需要清仓处理
        walletTrading.currentTokenValue = walletTrading.currentTokenValue.filter(tokenValue => {
            if (tokenValue.totalBuyAmount > 0) {
                const sellRatio = tokenValue.totalSellAmount / tokenValue.totalBuyAmount;

                if (sellRatio > 0.99) {
                    // 用户已清仓，计算盈亏
                    const avgBuyPrice = tokenValue.tokenWeightBuyUsdPrice;
                    const avgSellPrice = tokenValue.tokenWeightSellUsdPrice;

                    if (avgSellPrice > avgBuyPrice) {
                        walletTrading.winCount += 1;
                    } else if (avgSellPrice < avgBuyPrice) {
                        walletTrading.loseCount += 1;
                    }

                    // 从currentTokenValue中移除该代币
                    return false;
                }
            }

            return true; // 保留未清仓的代币
        });

        resultSnapShot.push(walletTrading);
    }

    return resultSnapShot;
}

/**
 * todo
 * 获取用户上一次时间窗口的快照数据
 * @param userAddress 用户地址
 * @param snapshotTime 快照时间
 * @param timeWindow 时间窗口
 */
export const getPreWindowSnapshot = async (userAddress: string, snapshotTime: string, timeWindow: number): Promise<SnapShotForWalletTrading[]> => {
    const result: SnapShotForWalletTrading[] = [{
        walletAddress: "",
        snapshotTime: "0",
        perTLTradingValue: [],
        totalBuySolAmount: 0,
        totalBuyUsdAmount: 0,
        totalSellSolAmount: 0,
        totalSellUsdAmount: 0,
        buy_count: 0,
        sell_count: 0,
        solPrice: 0,
        winCount: 0,
        loseCount: 0,
        currentTokenValue: [],
    }]
    return result;
}


export const snapShotUserTokenData = async (startTimestamp: number, endTimestamp: number): Promise<SnapShotForWalletTrading[]> => {
    let pageNum = 1;
    const pageSize = 10000;
    let totalTokenTxData: SwapTransactionToken[] = [];
    while (true) {
        const tokenTxData = await SolanaBlockDataHandler.getXDaysDataByTimestamp(startTimestamp, endTimestamp, pageNum, pageSize);
        if (tokenTxData.length === 0) {
            break;
        }
        totalTokenTxData = [...totalTokenTxData, ...tokenTxData];
        pageNum++;
    }
    const tokenTxDataFilter = SolanaBlockDataHandler.filterTokenData(totalTokenTxData);
    return snapshotWalletTradingByTxData(tokenTxDataFilter);
}