import { BLACK_LIST_TOKEN } from "../constant/address_data/black_list.ts";
import { MEVBOT_ADDRESSES } from "../constant/address_data/mev_list.ts";
import { WALLET_BLACKLIST } from "../constant/address_data/wallet_black_list.ts";
import { SwapTransactionToken, TokenSwapFilterData } from "../type/swap.ts";


// 常量配置
const STABLE_TOKENS = ["wsol", "sol", "usdc"];
const MIN_TRANSACTION_AMOUNT = 0.01; // 最小交易金额
const TIME_WINDOW_START = Date.now() - 24 * 60 * 60 * 1000; // 24小时前
const TIME_WINDOW_END = Date.now(); // 现在

/**
 * 这个方法的目的是为了将从数据库中获取到的数据进行清洗 并转化为更加利于数据筛选的数据过滤器
 * 过滤方法：
 *  1. 去除来自黑名单的代币地址
 *  2. 去除来自黑名单的钱包地址
 *  3. 去除来自mevbot的地址
 *  4. 去除不在时间窗口内的交易
 *  5. 对token_address和quote_token_address进行分析 对两个币种都不是wsol,sol,usdc的交易剔除，将代币两边都是wsol,sol,usdc中的其中两项的给剔除
 *  6. 通过交换的数量来对代币的sol本位价格进行计算，当其中一个为usdc的时候 根据传入的native_token_usd_price进行计算
 *  7: 过滤最小交易金额
 *  8. 如果token_address 为 usdc,sol,wsol的一种 则判断为买
 *  9. 如果quote_address 为 usdc,sol,wsol的一种 则判断为卖
 * 
 * @param data 从数据库中获取到的数据
 * @returns 
 */

const filterTokenData = (data: SwapTransactionToken[], native_token_usd_price: number): TokenSwapFilterData[] => {

    const result: TokenSwapFilterData[] = [];

    for (const transaction of data) {
        if (BLACK_LIST_TOKEN.includes(transaction.token_address) ||
            BLACK_LIST_TOKEN.includes(transaction.quote_address)) {
            continue;
        }
        if (WALLET_BLACKLIST.includes(transaction.wallet_address)) {
            continue;
        }

        if (MEVBOT_ADDRESSES.includes(transaction.wallet_address)) {
            continue;
        }

        const transactionTime = transaction.transaction_time * 1000; // 转换为毫秒
        if (transactionTime < TIME_WINDOW_START || transactionTime > TIME_WINDOW_END) {
            continue;
        }

        const tokenIsStable = STABLE_TOKENS.includes(transaction.token_address.toLowerCase());
        const quoteIsStable = STABLE_TOKENS.includes(transaction.quote_address.toLowerCase());

        if (!tokenIsStable && !quoteIsStable) {
            continue;
        }

        if (tokenIsStable && quoteIsStable) {
            continue;
        }

        let calculatedUsdPrice = transaction.usd_price;
        let calculatedUsdAmount = transaction.usd_amount;


        if (transaction.quote_address.toLowerCase() === "usdc") {
            calculatedUsdPrice = transaction.quote_price;
            calculatedUsdAmount = transaction.token_amount * calculatedUsdPrice;
        } else if (transaction.token_address.toLowerCase() === "usdc") {
            calculatedUsdPrice = transaction.quote_amount / transaction.token_amount;
            calculatedUsdAmount = transaction.token_amount * calculatedUsdPrice;
        } else if (STABLE_TOKENS.includes(transaction.quote_address.toLowerCase()) &&
            transaction.quote_address.toLowerCase() !== "usdc") {
            const solPrice = transaction.quote_price;
            calculatedUsdPrice = solPrice * native_token_usd_price;
            calculatedUsdAmount = transaction.token_amount * calculatedUsdPrice;
        }

        if (calculatedUsdAmount < MIN_TRANSACTION_AMOUNT) {
            continue;
        }

        let isBuy = false;
        if (STABLE_TOKENS.includes(transaction.token_address.toLowerCase())) {
            isBuy = true; // 买入操作：用稳定币买代币
        } else if (STABLE_TOKENS.includes(transaction.quote_address.toLowerCase())) {
            isBuy = false; // 卖出操作：卖代币换稳定币
        }

        const filteredData: TokenSwapFilterData = {
            userAddress: transaction.wallet_address,
            poolAddress: "",
            txHash: transaction.tx_hash,
            isBuy: isBuy,
            blockHeight: 0,
            tokenSymbol: transaction.token_symbol,
            tokenAddress: transaction.token_address,
            quoteSymbol: transaction.quote_symbol,
            quoteAddress: transaction.quote_address,
            quotePrice: transaction.quote_price,
            usdPrice: calculatedUsdPrice,
            usdAmount: calculatedUsdAmount,
            transactionTime: transaction.transaction_time,
            tokenAmount: transaction.token_amount,
            quoteAmount: transaction.quote_amount,
        };

        result.push(filteredData);
    }

    return result;
};


/**
 * 这个方法是通过从数据库中获取到的数据 进行地址维度的计算
 * 
 * @param data 
 */
const smartMoneyFilter = (data: TokenSwapFilterData[]) => {
    const result: TokenSwapFilterData[] = []
}


const parseSmartMoney = (data: any) => {
    const { native_token_balance, wallet_balance, profit, effective_win_token_pct, token_buy_counts, active_days } = data;
    return {
        native_token_balance,
        wallet_balance,
        profit,
        effective_win_token_pct,
        token_buy_counts,
        active_days,
    };
};