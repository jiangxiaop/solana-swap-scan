import { VersionedBlockResponse } from "npm:@solana/web3.js@1.98.2";
import { exportDexparserInstance } from "../collection/dex-parser.ts";
import { MathUtil } from "../utils/MathUtil.ts";
import { SOLANA_DEX_ADDRESS_TO_NAME, SOLANA_DEX_BASE_TOKEN } from "../constant/index.ts";
import { TokenPriceService } from "./TokenPriceService.ts";
import { ParseResult } from "../type/index.ts";
import clickhouseClient from "../../config/clickhouse.ts";
import { SwapTransactionToken, TokenSwapFilterData } from "../type/swap.ts";
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
}

export class SolanaBlockDataHandler {
  public static async handleBlockData(
    blockData: VersionedBlockResponse,
    blockNumber: number,
  ) {
    try {
      const parseResult = await exportDexparserInstance.parseBlockData(
        blockData,
        blockNumber,
      );
      const fileteTransactions = parseResult.filter((tx) =>
        tx.result?.trades?.length > 0 && tx.trades.length > 0
      );
      const swapTransactionArray = [];
      for (let index = 0; index < fileteTransactions.length; index++) {
        const tx = fileteTransactions[index];
        for (let index = 0; index < tx.trades.length; index++) {
          try {
            const swapTransaction = await SolanaBlockDataHandler.convertData(
              tx,
              index,
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
        await this.insertToTokenTable(swapTransactionArray);
        await this.insertToWalletTable(swapTransactionArray);
      }
    } catch (e) {
      console.log(`SolanaBlockDataHandler.handleBlockData error,blockNumber:${blockNumber}`, e); //non
    }
  }
  static async convertData(
    parseResult: ParseResult,
    index: number,
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
    if (tradeType === "BUY") {
      tokenAmount = tradeDetail.token_out_amount;
      tokenSymbol = tradeDetail.token_out_symbol;
      tokenAddress = tradeDetail.token_out_mint;
      quoteSymbol = tradeDetail.token_in_symbol;
      quoteAmount = tradeDetail.token_in_amount;
      quoteAddress = tradeDetail.token_in_mint;
      quotePrice = MathUtil.divide(quoteAmount, tokenAmount); //quoteAmount / tokenAmount;
    } else {
      tokenAmount = tradeDetail.token_in_amount;
      tokenSymbol = tradeDetail.token_in_symbol;
      tokenAddress = tradeDetail.token_in_mint;
      quoteSymbol = tradeDetail.token_out_symbol;
      quoteAmount = tradeDetail.token_out_amount;
      quoteAddress = tradeDetail.token_out_mint;
      quotePrice = MathUtil.divide(quoteAmount, tokenAmount); //quoteAmount / tokenAmount;
    }
    quotePrice = MathUtil.toFixed(quotePrice);
    quoteSymbol = SOLANA_DEX_ADDRESS_TO_NAME[quoteAddress];
    if (!quoteSymbol) {
      console.log(`quoteSymbol not support ${quoteAddress} `);
      return null;
    }
    const quoteTokenUSDPrice = await TokenPriceService.getPrice(
      quoteSymbol,
      "USDT",
    );
    let usdPrice = MathUtil.multiply(quotePrice, quoteTokenUSDPrice); //quotePrice * quoteTokenUSDPrice;
    usdPrice = MathUtil.toFixed(usdPrice);
    let usdAmount = MathUtil.multiply(quoteTokenUSDPrice, quoteAmount); //quoteAmount * usdPrice;
    usdAmount = MathUtil.toFixed(usdAmount);
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
    }));

    await clickhouseClient.insert({
      table: "solana_swap_transactions_token",
      values,
      format: "JSONEachRow",
    });

    console.log(`✅ 插入 ${values.length} 条记录到 solana_swap_transactions_token`);
  }

  // 读取单位时间后的x条数据
  static async getXDaysData(timestamp: number, limit = 0): Promise<SwapTransactionToken[]> {
    const data = await clickhouseClient.query({
      query: `SELECT * FROM solana_swap_transactions_token WHERE transaction_time > ${timestamp} ${limit > 0 ? `LIMIT ${limit}` : ''}`,
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

      let isBuy = false;
      if (LOWER_DEX_BASE_TOKEN.includes(transaction.token_address.toLowerCase())) {
        isBuy = true;
      } else if (LOWER_DEX_BASE_TOKEN.includes(transaction.quote_address.toLowerCase())) {
        isBuy = false;
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

}
