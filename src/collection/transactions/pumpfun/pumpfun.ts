
import { SOLANA_DEX_OFFICIAL_ADDRESS } from "../../../constant/config.ts";
import solana_connect_instance from "../../../lib/solana.ts";
import { Protocol } from "../../../type/enum.ts";

// Solana 原生代币信息
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;

export const getBlockValue = async (blockNumber: number) => {
    const connection = solana_connect_instance.getConnection();
    const block = await connection.getBlock(
        blockNumber,
        {
            // commitment: "confirmed",
            // transactionDetails: "full",
            maxSupportedTransactionVersion: 0,
            // rewards: false,
        },
    );
    return block;
}


export const filterPumpfunTransactions = async (blockNumber: number) => {
    const block = await getBlockValue(blockNumber);
    if (!block) {
        return [];
    }
    const transactions = block.transactions;

    const pumpfunTransaction: any[] = []
    console.log("got transaciton number: ", transactions.length);

    transactions.forEach((transaction: any) => {
        if (transaction.meta.err != null) {
            return;
        }
        if (transaction.transaction.message.accountKeys?.length && transaction.transaction.message.accountKeys.length > 0) {
            for (let i = 0; i < transaction.transaction.message.accountKeys.length; i++) {
                if (transaction.transaction.message.accountKeys[i].toString() == SOLANA_DEX_OFFICIAL_ADDRESS[Protocol.PUMPFUN]) {
                    pumpfunTransaction.push(transaction);
                }
            }
        }
        return false;

        // transaction.transaction.message.accountKeys.forEach((item: PublicKey,index:number)=>{
        //     if(item.toString() == SOLANA_DEX_OFFICIAL_ADDRESS[Protocol.PUMPFUN]){
        //         console.log("got pumpfun transaction: ", item.toString());
        //     }
        // })

    });

    console.log("got pumpfun transaction number: ", pumpfunTransaction.length);

    const pumpfunTransactionInfos = pumpfunTransaction.map(tx => parsePumpfunTransaction(tx));
    console.log("got pumpfun transaction infos number: ", pumpfunTransactionInfos.length);

    return pumpfunTransactionInfos;
}

// Pumpfun交易操作类型
export enum PumpfunOperationType {
    BUY = "buy",
    SELL = "sell",
    CREATE_TOKEN = "create_token",
    CREATE_POOL = "create_pool",
    ADD_LIQUIDITY = "add_liquidity",
    REMOVE_LIQUIDITY = "remove_liquidity",
    UNKNOWN = "unknown"
}

// Pumpfun交易解析结果 - 符合 dex_swap_events 表结构
export interface PumpfunTransactionInfo {
    // 基础信息
    transaction_signature: string;
    block_time: number;
    slot: number;
    user_address: string;
    protocol: string; // 'pumpfun'
    
    // 池子信息
    pool_address?: string;
    
    // 代币信息
    token_in_mint: string;
    token_out_mint: string;
    token_in_amount: number; // 已调整精度的数量
    token_out_amount: number; // 已调整精度的数量
    token_in_amount_raw: string; // 原始数量字符串
    token_out_amount_raw: string; // 原始数量字符串
    token_in_symbol?: string;
    token_out_symbol?: string;
    token_in_decimals?: number;
    token_out_decimals?: number;
    
    // 交易详情
    usd_value?: number;
    price_impact?: number;
    fee_amount: number;
    is_direct_route: boolean; // Pumpfun 通常是直接交换
    slippage_bps?: number;
    
    // 状态信息
    status: 'success' | 'failed';
    error_message?: string;
    raw_data: string; // JSON 字符串
    
    // 兼容旧接口的字段（可选）
    operationType?: PumpfunOperationType;
    price?: number;
}

// 解析Pumpfun交易操作类型
export function parsePumpfunTransaction(transaction: any): PumpfunTransactionInfo {
    const signature = transaction.transaction.signatures[0];
    const meta = transaction.meta;
    const success = meta.err === null;
    const blockTime = transaction.blockTime || 0;
    const slot = transaction.slot || 0;
    const fee = meta.fee || 0;

    // 获取用户地址（通常是第一个账户）
    const user = transaction.transaction.message.accountKeys[0].toString();

    let operationType = PumpfunOperationType.UNKNOWN;
    let mint: string | undefined;
    let tokenAmount: number | undefined;
    let solAmount: number | undefined;
    let price: number | undefined;

    // 方法1: 通过日志信息判断
    if (meta.logMessages) {
        for (const log of meta.logMessages) {
            if (log.includes("Instruction: Buy")) {
                operationType = PumpfunOperationType.BUY;
                break;
            } else if (log.includes("Instruction: Sell")) {
                operationType = PumpfunOperationType.SELL;
                break;
            } else if (log.includes("Instruction: Create") || log.includes("InitializeMint")) {
                operationType = PumpfunOperationType.CREATE_TOKEN;
                break;
            }
        }
    }

    // 方法2: 通过token余额变化分析
    if (operationType === PumpfunOperationType.UNKNOWN && success) {
        const analysis = analyzeTokenBalanceChanges(meta);
        operationType = analysis.operationType;
        mint = analysis.mint;
        tokenAmount = analysis.tokenAmount;
        solAmount = analysis.solAmount;
        price = analysis.price;
    }

    // 如果通过日志已经确定类型，再分析具体数值
    if ((operationType === PumpfunOperationType.BUY || operationType === PumpfunOperationType.SELL) && !mint) {
        const analysis = analyzeTokenBalanceChanges(meta);
        mint = analysis.mint;
        tokenAmount = analysis.tokenAmount;
        solAmount = analysis.solAmount;
        price = analysis.price;
    }

    // 根据操作类型确定输入输出代币
    let token_in_mint: string;
    let token_out_mint: string;
    let token_in_amount: number;
    let token_out_amount: number;
    let token_in_amount_raw: string;
    let token_out_amount_raw: string;
    let token_in_decimals: number;
    let token_out_decimals: number;

    if (operationType === PumpfunOperationType.BUY) {
        // 买入：SOL -> Token
        token_in_mint = SOL_MINT;
        token_out_mint = mint || "";
        token_in_amount = solAmount || 0;
        token_out_amount = tokenAmount || 0;
        token_in_decimals = SOL_DECIMALS;
        token_out_decimals = 6; // Pumpfun 代币通常是 6 位精度
        token_in_amount_raw = Math.round((solAmount || 0) * Math.pow(10, SOL_DECIMALS)).toString();
        token_out_amount_raw = Math.round((tokenAmount || 0) * Math.pow(10, token_out_decimals)).toString();
    } else if (operationType === PumpfunOperationType.SELL) {
        // 卖出：Token -> SOL
        token_in_mint = mint || "";
        token_out_mint = SOL_MINT;
        token_in_amount = tokenAmount || 0;
        token_out_amount = solAmount || 0;
        token_in_decimals = 6; // Pumpfun 代币通常是 6 位精度
        token_out_decimals = SOL_DECIMALS;
        token_in_amount_raw = Math.round((tokenAmount || 0) * Math.pow(10, token_in_decimals)).toString();
        token_out_amount_raw = Math.round((solAmount || 0) * Math.pow(10, SOL_DECIMALS)).toString();
    } else {
        // 未知操作类型，使用默认值
        token_in_mint = mint || SOL_MINT;
        token_out_mint = SOL_MINT;
        token_in_amount = 0;
        token_out_amount = 0;
        token_in_decimals = 6;
        token_out_decimals = SOL_DECIMALS;
        token_in_amount_raw = "0";
        token_out_amount_raw = "0";
    }

    return {
        // 基础信息
        transaction_signature: signature,
        block_time: blockTime,
        slot: slot,
        user_address: user,
        protocol: 'pumpfun',
        
        // 池子信息
        pool_address: undefined, // 需要从交易中提取
        
        // 代币信息
        token_in_mint,
        token_out_mint,
        token_in_amount,
        token_out_amount,
        token_in_amount_raw,
        token_out_amount_raw,
        token_in_symbol: token_in_mint === SOL_MINT ? 'SOL' : undefined,
        token_out_symbol: token_out_mint === SOL_MINT ? 'SOL' : undefined,
        token_in_decimals,
        token_out_decimals,
        
        // 交易详情
        usd_value: undefined, // 需要外部价格数据
        price_impact: undefined, // 需要计算
        fee_amount: fee / Math.pow(10, SOL_DECIMALS), // 手续费转换为 SOL
        is_direct_route: true, // Pumpfun 是直接交换
        slippage_bps: undefined, // 需要从交易参数中提取
        
        // 状态信息
        status: success ? 'success' : 'failed',
        error_message: success ? undefined : (meta.err ? JSON.stringify(meta.err) : undefined),
        raw_data: JSON.stringify(transaction),
        
        // 兼容旧接口
        operationType,
        price
    };
}

// 分析token余额变化来判断操作类型
function analyzeTokenBalanceChanges(meta: any) {
    let operationType = PumpfunOperationType.UNKNOWN;
    let mint: string | undefined;
    let tokenAmount: number | undefined;
    let solAmount: number | undefined;
    let price: number | undefined;

    if (!meta.preTokenBalances || !meta.postTokenBalances) {
        return { operationType, mint, tokenAmount, solAmount, price };
    }

    // 构建余额变化映射
    const balanceChanges = new Map<string, {
        mint: string;
        preAmount: number;
        postAmount: number;
        change: number;
    }>();

    // 处理交易后余额
    for (const post of meta.postTokenBalances) {
        const key = `${post.accountIndex}-${post.mint}`;
        const postAmount = parseFloat(post.uiTokenAmount.uiAmountString || "0");

        balanceChanges.set(key, {
            mint: post.mint,
            preAmount: 0,
            postAmount,
            change: postAmount
        });
    }

    // 处理交易前余额
    for (const pre of meta.preTokenBalances) {
        const key = `${pre.accountIndex}-${pre.mint}`;
        const preAmount = parseFloat(pre.uiTokenAmount.uiAmountString || "0");

        if (balanceChanges.has(key)) {
            const existing = balanceChanges.get(key)!;
            existing.preAmount = preAmount;
            existing.change = existing.postAmount - preAmount;
        } else {
            balanceChanges.set(key, {
                mint: pre.mint,
                preAmount,
                postAmount: 0,
                change: -preAmount
            });
        }
    }

    // 分析变化模式
    let solChange = 0;
    let tokenChanges: Array<{ mint: string; change: number }> = [];

    for (const [key, balance] of balanceChanges) {
        if (balance.mint === "So11111111111111111111111111111111111111112") {
            // SOL变化
            solChange += balance.change;
        } else {
            // 其他代币变化
            if (Math.abs(balance.change) > 0.000001) { // 忽略极小变化
                tokenChanges.push({
                    mint: balance.mint,
                    change: balance.change
                });
            }
        }

    }

    // 判断操作类型
    if (tokenChanges.length > 0) {
        const mainTokenChange = tokenChanges[0];
        mint = mainTokenChange.mint;
        tokenAmount = Math.abs(mainTokenChange.change);
        solAmount = Math.abs(solChange);

        if (mainTokenChange.change > 0 && solChange < 0) {
            // 代币增加，SOL减少 = 买入
            operationType = PumpfunOperationType.BUY;
        } else if (mainTokenChange.change < 0 && solChange > 0) {
            // 代币减少，SOL增加 = 卖出
            operationType = PumpfunOperationType.SELL;
        }

        // 计算价格
        if (tokenAmount && solAmount && tokenAmount > 0) {
            price = solAmount / tokenAmount;
        }
    }

    return { operationType, mint, tokenAmount, solAmount, price };
}

// 批量解析Pumpfun交易
export function batchParsePumpfunTransactions(transactions: any[]): PumpfunTransactionInfo[] {
    return transactions.map(tx => parsePumpfunTransaction(tx));
}

// 过滤特定操作类型的交易
export function filterByOperationType(
    transactions: PumpfunTransactionInfo[],
    operationType: PumpfunOperationType
): PumpfunTransactionInfo[] {
    return transactions.filter(tx => tx.operationType === operationType);
}

// 获取交易统计信息
export function getPumpfunTransactionStats(transactions: PumpfunTransactionInfo[]) {
    const stats = {
        total: transactions.length,
        successful: 0,
        failed: 0,
        buy: 0,
        sell: 0,
        createToken: 0,
        addLiquidity: 0,
        unknown: 0,
        totalVolume: 0,
        averagePrice: 0
    };

    let totalPrices = 0;
    let priceCount = 0;

    for (const tx of transactions) {
        if (tx.success) {
            stats.successful++;
        } else {
            stats.failed++;
        }

        switch (tx.operationType) {
            case PumpfunOperationType.BUY:
                stats.buy++;
                break;
            case PumpfunOperationType.SELL:
                stats.sell++;
                break;
            case PumpfunOperationType.CREATE_TOKEN:
                stats.createToken++;
                break;
            case PumpfunOperationType.ADD_LIQUIDITY:
                stats.addLiquidity++;
                break;
            default:
                stats.unknown++;
        }

        if (tx.solAmount) {
            stats.totalVolume += tx.solAmount;
        }

        if (tx.price) {
            totalPrices += tx.price;
            priceCount++;
        }
    }

    if (priceCount > 0) {
        stats.averagePrice = totalPrices / priceCount;
    }

    return stats;
}



