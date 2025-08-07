import { VersionedBlockResponse } from "@solana/web3.js";
import { exportDexparserInstance } from "../collection/dex-parser.ts";
import { MathUtil } from "../utils/MathUtil.ts";
import { SOLANA_DEX_ADDRESS_TO_NAME, SOLANA_DEX_BASE_TOKEN } from "../constant/index.ts";
import { TokenPriceService } from "./TokenPriceService.ts";
import { ParseResult } from "../type/index.ts";
import clickhouseClient from "../../config/clickhouse.ts";
import { ESwapTradeType, SwapTransactionToken, TokenSwapFilterData } from "../type/swap.ts";
import { BLACK_LIST_TOKEN } from "../constant/address_data/black_list.ts";
import { WALLET_BLACKLIST } from "../constant/address_data/wallet_black_list.ts";
import { MEVBOT_ADDRESSES } from "../constant/address_data/mev_list.ts";
import { SNAP_SHOT_CONFIG, SOLANA_DEX_STABLE_TOKEN } from "../constant/config.ts";

interface SwapTransaction {
  txHash: string;
  transactionTime: number; // 秒级时间戳
  walletAddress: string;
  tokenAmount: number;
  tokenSymbol: string;
  tokenAddress: string;
  quoteSymbol: string;
  quoteAmount: number;
  quoteAddress: string;
  quotePrice: string;
  usdPrice: string;
  usdAmount: string;
  tradeType: string;
  poolAddress: string;
  blockHeight: number;
}

export class SolanaBlockDataHandler {


  public static async handleMultiBlockData(
    data: {
      blockdata: VersionedBlockResponse,
      blocknum: number,
    }[]
  ) {

    const start = Date.now();

    // 检查是否启用高性能模式（通过环境变量控制）
    // @ts-ignore: Deno is available in runtime
    const isHighPerformanceMode = Deno.env.get("HIGH_PERFORMANCE_MODE") === "true";

    if (isHighPerformanceMode) {
      return await this.handleMultiBlockDataHighPerformance(data, start);
    } else {
      return await this.handleMultiBlockDataMemoryOptimized(data, start);
    }
  }

  // 高性能版本：速度优先
  private static async handleMultiBlockDataHighPerformance(
    data: {
      blockdata: VersionedBlockResponse,
      blocknum: number,
    }[],
    start: number
  ) {
    const swapTransactionArray: SwapTransaction[] = [];

    // 无限制并发处理 - 最大化速度
    const parseResult = await Promise.all(data.map(async (block) => {
      try {
        const result = await this.handleBlockData(block.blockdata, block.blocknum);
        swapTransactionArray.push(...result);
        return result;
      } catch (error) {
        console.error(`Error processing block ${block.blocknum}:`, error.message);
        return []; // 返回空数组而不是中断整个处理
      }
    }));

    // 一次性批量插入 - 最大化数据库性能
    if (swapTransactionArray.length > 0) {
      await this.insertToHistoryTable(swapTransactionArray);
    }

    console.log(`HIGH PERFORMANCE: parse ${data.length} blocks, cost: ${Date.now() - start} ms`);
    return parseResult;
  }

  // 内存优化版本：稳定性优先
  private static async handleMultiBlockDataMemoryOptimized(
    data: {
      blockdata: VersionedBlockResponse,
      blocknum: number,
    }[],
    start: number
  ) {
    const BATCH_SIZE = 10; // 控制并发数量，避免内存峰值
    const MAX_MEMORY_ITEMS = 1000; // 最大内存项数，防止OOM

    // 分批处理，避免内存峰值
    const results: SwapTransaction[][] = [];
    let totalProcessed = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

      try {
        // 限制并发处理批次
        const batchResults = await Promise.all(batch.map(async (block) => {
          try {
            return await this.handleBlockData(block.blockdata, block.blocknum);
          } catch (error) {
            console.error(`Error processing block ${block.blocknum}:`, error.message);
            return []; // 返回空数组而不是中断整个处理
          }
        }));

        // 立即处理并保存数据，避免累积
        const batchTransactions: SwapTransaction[] = [];
        for (const result of batchResults) {
          batchTransactions.push(...result);

          // 如果累积的数据太多，立即保存并清理
          if (batchTransactions.length > MAX_MEMORY_ITEMS) {
            await this.insertToHistoryTable(batchTransactions);
            batchTransactions.length = 0; // 清空数组

            // 强制垃圾回收（如果可用）
            this.forceGarbageCollection();
          }
        }

        // 保存剩余的数据
        if (batchTransactions.length > 0) {
          await this.insertToHistoryTable(batchTransactions);
        }

        results.push(...batchResults);
        totalProcessed += batch.length;

        console.log(`MEMORY OPTIMIZED: Processed batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}/${Math.ceil(data.length / BATCH_SIZE)}, total: ${totalProcessed}/${data.length}`);

        // 批次间短暂延迟，给GC时间
        if (i + BATCH_SIZE < data.length) {
          await this.delay(10);
        }

      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error.message);
        // 继续处理下一批，不中断整个流程
      }
    }

    console.log(`MEMORY OPTIMIZED: parse ${data.length} blocks, cost: ${Date.now() - start} ms`);
    return results;
  }

  // 辅助方法：延迟
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 辅助方法：强制垃圾回收
  private static forceGarbageCollection(): void {
    try {
      // @ts-ignore: gc may not be available
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    } catch (error) {
      // 忽略GC错误
    }
  }


  public static async handleBlockData(
    blockData: VersionedBlockResponse,
    blockNumber: number,
  ) {

    const parseResult = exportDexparserInstance.parseBlockData(
      blockData,
      blockNumber,
    );


    const fileteTransactions = parseResult.filter((tx) =>
      tx.result?.trades?.length > 0
    );

    const swapTransactionArray: SwapTransaction[] = [];
    for (let index = 0; index < fileteTransactions.length; index++) {
      const tx = fileteTransactions[index];
      for (let index = 0; index < tx.trades.length; index++) {
        try {
          const swapTransaction = await SolanaBlockDataHandler.convertData(
            tx,
            index,
            blockNumber
          );
          if (swapTransaction) {
            swapTransactionArray.push(swapTransaction);
          }
        } catch (error) {
          console.log("SolanaBlockDataHandler.convertData error", error);
        }
      }
    }

    if (swapTransactionArray.length > 0) {
      // await this.insertToTokenTable(swapTransactionArray);
      // await this.insertToWalletTable(swapTransactionArray);
      // await this.insertToHistoryTable(swapTransactionArray);
    }

    return swapTransactionArray
  }
  static async convertData(
    parseResult: ParseResult,
    index: number,
    blockNumber: number
  ): Promise<SwapTransaction | null> {
    const tradeDetail = parseResult.result.trades[index];
    let tradeType = parseResult.trades[index].type;

    const txHash = tradeDetail.transaction_signature;
    const transactionTime = tradeDetail.block_time;
    const walletAddress = tradeDetail.user_address;
    let tokenAmount;
    let tokenSymbol;
    let tokenAddress;
    let quoteSymbol;
    let quoteAmount;
    let quoteAddress;
    let quotePrice;
    let poolAddress = tradeDetail.pool_address;
    if (tradeType === "BUY") {
      tokenAmount = tradeDetail.token_out_amount;
      tokenSymbol = tradeDetail.token_out_symbol;
      tokenAddress = tradeDetail.token_out_mint;
      quoteSymbol = tradeDetail.token_in_symbol;
      quoteAmount = tradeDetail.token_in_amount;
      quoteAddress = tradeDetail.token_in_mint;
    } else {
      tokenAmount = tradeDetail.token_in_amount;
      tokenSymbol = tradeDetail.token_in_symbol;
      tokenAddress = tradeDetail.token_in_mint;
      quoteSymbol = tradeDetail.token_out_symbol;
      quoteAmount = tradeDetail.token_out_amount;
      quoteAddress = tradeDetail.token_out_mint;
    }

    // 验证数据完整性
    // if (!tokenAmount || tokenAmount <= 0) {
    //   console.log(`Invalid tokenAmount: ${tokenAmount}, skipping transaction ${txHash}`);
    //   return null;
    // }

    // if (!quoteAmount || quoteAmount <= 0) {
    //   console.log(`Invalid quoteAmount: ${quoteAmount}, skipping transaction ${txHash}`);
    //   return null;
    // }

    // 使用安全除法避免除零错误
    quotePrice = MathUtil.safeDivide(quoteAmount, tokenAmount, "0");
    
    // 验证 quotePrice 是否超过 ClickHouse Decimal(18,8) 的限制
    // Decimal(18,8) 最大整数值：10^10 - 1 = 9,999,999,999
    const maxDecimalValue = 9999999999.99999999;
    const quotePriceNum = parseFloat(quotePrice);
    
    if (quotePriceNum > maxDecimalValue) {
      console.log(`quotePrice ${quotePrice} exceeds ClickHouse Decimal(18,8) limit, skipping transaction ${txHash}`);
      return null;
    }
    
    quotePrice = MathUtil.toFixed(quotePrice);

    // 验证 quoteAddress 是否有效
    if (!quoteAddress || typeof quoteAddress !== 'string') {
      quoteAddress = ""
    }

    quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[quoteAddress];
    if (!quoteSymbol) {
      quoteSymbol = "";
    }
    const quoteTokenUSDPrice = 1
    let usdPrice = MathUtil.multiply(quotePrice, quoteTokenUSDPrice); //quotePrice * quoteTokenUSDPrice;
    usdPrice = MathUtil.toFixed(usdPrice);
    let usdAmount = MathUtil.multiply(quoteTokenUSDPrice, quoteAmount); //quoteAmount * usdPrice;
    usdAmount = MathUtil.toFixed(usdAmount);
    
    // 验证 usdPrice 和 usdAmount 是否超过 ClickHouse Decimal(18,8) 的限制
    const usdPriceNum = parseFloat(usdPrice);
    const usdAmountNum = parseFloat(usdAmount);
    
    if (usdPriceNum > maxDecimalValue) {
      console.log(`usdPrice ${usdPrice} exceeds ClickHouse Decimal(18,8) limit, skipping transaction ${txHash}`);
      return null;
    }
    
    if (usdAmountNum > maxDecimalValue) {
      console.log(`usdAmount ${usdAmount} exceeds ClickHouse Decimal(18,8) limit, skipping transaction ${txHash}`);
      return null;
    }

    const data = {
      txHash,
      transactionTime,
      walletAddress,
      tokenAmount,
      tokenSymbol,
      tokenAddress,
      quoteSymbol,
      quoteAmount,
      quoteAddress,
      quotePrice,
      usdPrice,
      usdAmount,
      tradeType,
      poolAddress,
      blockHeight: blockNumber,
    };
    return data;
  }

  // 写入 wallet 表
  static async insertToWalletTable(rows: SwapTransaction[]) {
    const values = rows.map((tx) => ({
      tx_hash: tx.txHash,
      transaction_time: tx.transactionTime,
      wallet_address: tx.walletAddress,
      token_amount: tx.tokenAmount,
      token_symbol: tx.tokenSymbol,
      token_address: tx.tokenAddress,
      quote_symbol: tx.quoteSymbol,
      quote_amount: tx.quoteAmount,
      quote_address: tx.quoteAddress,
      quote_price: parseFloat(tx.quotePrice),
      usd_price: parseFloat(tx.usdPrice),
      usd_amount: parseFloat(tx.usdAmount),
      trade_type: tx.tradeType,
      block_height: tx.blockHeight,
      pool_address: tx.poolAddress
    }));

    await clickhouseClient.insert({
      table: "solana_swap_transactions_wallet",
      values,
      format: "JSONEachRow",
    });

    console.log(`✅ 插入 ${values.length} 条记录到 solana_swap_transactions_wallet`);
  }

  // 写入 token 表
  static async insertToTokenTable(rows: SwapTransaction[]) {
    const values = rows.map((tx) => ({
      tx_hash: tx.txHash,
      transaction_time: tx.transactionTime,
      wallet_address: tx.walletAddress,
      token_amount: tx.tokenAmount,
      token_symbol: tx.tokenSymbol,
      token_address: tx.tokenAddress,
      quote_symbol: tx.quoteSymbol,
      quote_amount: tx.quoteAmount,
      quote_address: tx.quoteAddress,
      quote_price: parseFloat(tx.quotePrice),
      usd_price: parseFloat(tx.usdPrice),
      usd_amount: parseFloat(tx.usdAmount),
      trade_type: tx.tradeType,
      block_height: tx.blockHeight,
      pool_address: tx.poolAddress
    }));

    await clickhouseClient.insert({
      table: "solana_swap_transactions_token",
      values,
      format: "JSONEachRow",
    });

    console.log(`✅ 插入 ${values.length} 条记录到 solana_swap_transactions_token`);
  }


  static async insertToHistoryTable(rows: SwapTransaction[]) {
    const values = rows.map((tx) => ({
      tx_hash: tx.txHash,
      trade_type: tx.tradeType,
      block_height: tx.blockHeight,
      pool_address: tx.poolAddress,
      transaction_time: tx.transactionTime,
      wallet_address: tx.walletAddress,
      token_amount: tx.tokenAmount,
      token_symbol: tx.tokenSymbol,
      token_address: tx.tokenAddress,
      quote_symbol: tx.quoteSymbol,
      quote_amount: tx.quoteAmount,
      quote_address: tx.quoteAddress,
      quote_price: parseFloat(tx.quotePrice),
      usd_price: parseFloat(tx.usdPrice),
      usd_amount: parseFloat(tx.usdAmount),
    }));

    await clickhouseClient.insert({
      table: "solana_history_data_new",
      values,
      format: "JSONEachRow",
    });

    console.log(`✅ 插入 ${values.length} 条记录到 solana_history_data_new`);
  }


  // 读取单位时间后的x条数据
  static async getXDaysData(timestamp: number, limit = 0): Promise<SwapTransactionToken[]> {
    const data = await clickhouseClient.query({
      query: `SELECT * FROM solana_swap_transactions_token WHERE transaction_time > ${timestamp} ORDER BY transaction_time asc ${limit > 0 ? `LIMIT ${limit}` : ''} `,
      format: 'JSONEachRow'
    });
    const rows = await data.json();
    return rows as SwapTransactionToken[];
  }


  static async getXDaysDataByTimestamp(startTimestamp: number, endTimestamp: number, pageNum: number, pageSize: number): Promise<SwapTransactionToken[]> {
    const data = await clickhouseClient.query({
      query: `SELECT * FROM solana_swap_transactions_token WHERE transaction_time > ${startTimestamp} AND transaction_time < ${endTimestamp} ORDER BY transaction_time DESC LIMIT ${pageNum * pageSize},${pageSize}`,
      format: 'JSONEachRow'
    });

    const rows = await data.json();
    return rows as SwapTransactionToken[];
  }

  /**
   * 基于区块高度范围获取交易数据
   * @param startBlockHeight 起始区块高度
   * @param endBlockHeight 结束区块高度
   * @returns Promise<SwapTransactionToken[]>
   */
  static async getDataByBlockHeightRange(startBlockHeight: number, endBlockHeight: number): Promise<SwapTransactionToken[]> {
    const data = await clickhouseClient.query({
      query: `SELECT * FROM solana_swap_transactions_token WHERE block_height >= ${startBlockHeight} AND block_height <= ${endBlockHeight} ORDER BY block_height ASC`,
      format: 'JSONEachRow'
    });

    const rows = await data.json();
    return rows as SwapTransactionToken[];
  }

  static filterTokenData(data: SwapTransactionToken[]): TokenSwapFilterData[] {

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

      const LOWER_DEX_BASE_TOKEN = SOLANA_DEX_BASE_TOKEN.map(token => token.toLowerCase());

      const tokenIsBase = LOWER_DEX_BASE_TOKEN.includes(transaction.token_address.toLowerCase());
      const quoteIsBase = LOWER_DEX_BASE_TOKEN.includes(transaction.quote_address.toLowerCase());

      if (!tokenIsBase && !quoteIsBase) {
        continue;
      }

      if (tokenIsBase && quoteIsBase) {
        continue;
      }

      const calculatedUsdPrice = transaction.usd_price;
      const calculatedUsdAmount = transaction.usd_amount;


      if (calculatedUsdAmount < SNAP_SHOT_CONFIG.MIN_TRANSACTION_AMOUNT) {
        continue;
      }



      const filteredData: TokenSwapFilterData = {
        userAddress: transaction.wallet_address,
        poolAddress: "",
        txHash: transaction.tx_hash,
        isBuy: transaction.trade_type === ESwapTradeType.BUY,
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

}
