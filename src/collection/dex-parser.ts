import { DEX_PROGRAMS } from '../constant/dex_config.ts';
import { InstructionClassifier } from './parser/instruction-classifier.ts';
import {
  JupiterLimitOrderParser,
  JupiterLimitOrderV2Parser,
  JupiterParser,
  MeteoraDAMMPoolParser,
  MeteoraDLMMPoolParser,
  MeteoraParser,
  MeteoraPoolsParser,
  OrcaLiquidityParser,
  OrcaParser,
  PumpfunEventParser,
  PumpfunParser,
  PumpswapEventParser,
  RaydiumCLPoolParser,
  RaydiumCPMMPoolParser,
  RaydiumLaunchpadEventParser,
  RaydiumLaunchpadParser,
  RaydiumParser,
  RaydiumV4PoolParser,
} from './parser/index.ts';
import { JupiterDcaParser } from './parser/jup/index.ts';
import { TransactionAdapter } from './parser/transaction-adapter.ts';
import { TransactionUtils } from './parser/transaction-utils.ts';
import {
  ClassifiedInstruction,
  DexInfo,
  ParseConfig,
  ParseResult,
  PoolEvent,
  SolanaTransaction,
  TradeInfo,
  TransferData,
} from '../type/index.ts';
import { getBlockValue, getProgramName } from '../lib/utils.ts';
import { ResSwapStruct } from "../type/filter_struct.ts";
import { PumpswapParser } from "./parser/pumpswap/parser-pumpswap.ts";
import { PumpswapLiquidityParser } from "./parser/pumpfun/parser-pumpswap-liquidity.ts";
import {getTokenInfoUseCache} from "../service/TokenInfoService.ts";
import redisClient from "../../config/redis.ts";
import {VersionedBlockResponse} from "npm:@solana/web3.js@1.98.2";

/**
 * Interface for DEX trade parsers
 */
type ParserConstructor = new (
  adapter: TransactionAdapter,
  dexInfo: DexInfo,
  transferActions: Record<string, TransferData[]>,
  classifiedInstructions: ClassifiedInstruction[]
) => {
  processTrades(): TradeInfo[];
};

/**
 * Interface for liquidity pool parsers
 */
type ParserLiquidityConstructor = new (
  adapter: TransactionAdapter,
  transferActions: Record<string, TransferData[]>,
  classifiedInstructions: ClassifiedInstruction[]
) => {
  processLiquidity(): PoolEvent[];
};

/**
 * Interface for Transfer parsers
 */
type ParserTransferConstructor = new (
  adapter: TransactionAdapter,
  dexInfo: DexInfo,
  transferActions: Record<string, TransferData[]>,
  classifiedInstructions: ClassifiedInstruction[]
) => {
  processTransfers(): TransferData[];
};

/**
 * Main parser class for Solana DEX transactions
 */
export class DexParser {
  // Trade parser mapping
  private readonly parserMap: Record<string, ParserConstructor> = {
    [DEX_PROGRAMS.JUPITER.id]: JupiterParser,
    [DEX_PROGRAMS.JUPITER_DCA.id]: JupiterDcaParser,
    [DEX_PROGRAMS.JUPITER_LIMIT_ORDER_V2.id]: JupiterLimitOrderV2Parser,
    [DEX_PROGRAMS.METEORA.id]: MeteoraParser,
    [DEX_PROGRAMS.METEORA_POOLS.id]: MeteoraParser,
    [DEX_PROGRAMS.METEORA_DAMM.id]: MeteoraParser,
    [DEX_PROGRAMS.PUMP_FUN.id]: PumpfunParser,
    [DEX_PROGRAMS.PUMP_SWAP.id]: PumpswapParser,
    [DEX_PROGRAMS.RAYDIUM_ROUTE.id]: RaydiumParser,
    [DEX_PROGRAMS.RAYDIUM_CL.id]: RaydiumParser,
    [DEX_PROGRAMS.RAYDIUM_CPMM.id]: RaydiumParser,
    [DEX_PROGRAMS.RAYDIUM_V4.id]: RaydiumParser,
    [DEX_PROGRAMS.RAYDIUM_LCP.id]: RaydiumLaunchpadParser,
    [DEX_PROGRAMS.ORCA.id]: OrcaParser,
  };

  // Liquidity parser mapping
  private readonly parseLiquidityMap: Record<string, ParserLiquidityConstructor> = {
    [DEX_PROGRAMS.METEORA.id]: MeteoraDLMMPoolParser,
    [DEX_PROGRAMS.METEORA_POOLS.id]: MeteoraPoolsParser,
    [DEX_PROGRAMS.METEORA_DAMM.id]: MeteoraDAMMPoolParser,
    [DEX_PROGRAMS.RAYDIUM_V4.id]: RaydiumV4PoolParser,
    [DEX_PROGRAMS.RAYDIUM_CPMM.id]: RaydiumCPMMPoolParser,
    [DEX_PROGRAMS.RAYDIUM_CL.id]: RaydiumCLPoolParser,
    [DEX_PROGRAMS.ORCA.id]: OrcaLiquidityParser,
    [DEX_PROGRAMS.PUMP_FUN.id]: PumpswapLiquidityParser,
    [DEX_PROGRAMS.PUMP_SWAP.id]: PumpswapLiquidityParser,
  };

  // Transfer parser mapping
  private readonly parseTransferMap: Record<string, ParserTransferConstructor> = {
    [DEX_PROGRAMS.JUPITER_DCA.id]: JupiterDcaParser,
    [DEX_PROGRAMS.JUPITER_LIMIT_ORDER.id]: JupiterLimitOrderParser,
    [DEX_PROGRAMS.JUPITER_LIMIT_ORDER_V2.id]: JupiterLimitOrderV2Parser,
  };

  constructor() { }

  /**
   * Parse transaction with specific type
   */
  private parseWithClassifier(
    tx: SolanaTransaction,
    config: ParseConfig = { tryUnknowDEX: true },
    parseType: 'trades' | 'liquidity' | 'transfer' | 'all'
  ): ParseResult {
    const result: ParseResult = {
      result: {
        trades: [],
        liquidities: [],
        tokens: [],
        tokenPrices: [],
        userTradingSummary: [],
      },
      state: true,
      fee: { amount: '0', uiAmount: 0, decimals: 9 },
      trades: [],
      liquidities: [],
      transfers: [],
      moreEvents: {},
    };

    try {
      const adapter = new TransactionAdapter(tx, config);
      const utils = new TransactionUtils(adapter);
      const classifier = new InstructionClassifier(adapter);

      // Get DEX information and validate
      const dexInfo = utils.getDexInfo(classifier);
      const allProgramIds = classifier.getAllProgramIds();
      const transferActions = utils.getTransferActions(['mintTo', 'burn', 'mintToChecked', 'burnChecked']);

      // Process fee
      result.fee = adapter.fee;

      // Process user balance change
      result.solBalanceChange = adapter.getAccountSolBalanceChanges(false)?.get(adapter.signer);
      result.tokenBalanceChange = adapter.getAccountTokenBalanceChanges(true)?.get(adapter.signer);

      // Try specific parser first
      if (
        dexInfo.programId &&
        [
          DEX_PROGRAMS.JUPITER.id,
          DEX_PROGRAMS.JUPITER_DCA.id,
          DEX_PROGRAMS.JUPITER_DCA_KEEPER1.id,
          DEX_PROGRAMS.JUPITER_DCA_KEEPER2.id,
          DEX_PROGRAMS.JUPITER_DCA_KEEPER3.id,
          DEX_PROGRAMS.JUPITER_VA.id,
          DEX_PROGRAMS.JUPITER_LIMIT_ORDER_V2.id,
        ].includes(dexInfo.programId)
      ) {
        if (parseType === 'trades' || parseType === 'all') {
          const jupiterInstructions = classifier.getInstructions(dexInfo.programId);

          const TradeParserClass = this.parserMap[dexInfo.programId];
          if (TradeParserClass) {
            const parser = new TradeParserClass(
              adapter,
              { ...dexInfo, programId: dexInfo.programId, amm: getProgramName(dexInfo.programId) },
              transferActions,
              jupiterInstructions
            );

            result.trades.push(...parser.processTrades());
          }
        }
        if (result.trades.length > 0) {
          return result;
        }
      }

      // Process instructions for each program
      for (const programId of allProgramIds) {
        const classifiedInstructions = classifier.getInstructions(programId);
        // Process trades if needed
        if (parseType === 'trades' || parseType === 'all') {
          if (config?.programIds && !config.programIds.some((id) => id == programId)) continue;
          if (config?.ignoreProgramIds && config.ignoreProgramIds.some((id) => id == programId)) continue;

          const TradeParserClass = this.parserMap[programId];
          if (TradeParserClass) {
            const parser = new TradeParserClass(
              adapter,
              { ...dexInfo, programId: programId, amm: getProgramName(programId) },
              transferActions,
              classifiedInstructions
            );
            result.trades.push(...parser.processTrades());
          } else if (config?.tryUnknowDEX) {
            // Handle unknown DEX programs
            const transfers = Object.entries(transferActions).find(([key]) => key.startsWith(programId))?.[1];
            if (transfers && transfers.length >= 2 && transfers.some((it) => adapter.isSupportedToken(it.info.mint))) {
              const trade = utils.processSwapData(transfers, {
                ...dexInfo,
                programId: programId,
                amm: getProgramName(programId),
              });

              if (trade) result.trades.push(utils.attachTokenTransferInfo(trade, transferActions));
            }
          }
        }

        // Process liquidity if needed
        if (parseType === 'liquidity' || parseType === 'all') {
          if (config?.programIds && !config.programIds.some((id) => id == programId)) continue;
          if (config?.ignoreProgramIds && config.ignoreProgramIds.some((id) => id == programId)) continue;

          const LiquidityParserClass = this.parseLiquidityMap[programId];
          if (LiquidityParserClass) {
            const parser = new LiquidityParserClass(adapter, transferActions, classifiedInstructions);
            result.liquidities.push(...utils.attachUserBalanceToLPs(parser.processLiquidity()));
          }
        }
      }
      // Deduplicate trades
      if (result.trades.length > 0) {
        result.trades = [...new Map(result.trades.map((item) => [`${item.idx}-${item.signature}`, item])).values()];
      }

      // Process transfer if needed (if no trades and no liquidity)
      if (result.trades.length == 0 && result.liquidities.length == 0) {
        if (parseType === 'transfer' || parseType === 'all') {
          if (dexInfo.programId) {
            const classifiedInstructions = classifier.getInstructions(dexInfo.programId);
            const TransferParserClass = this.parseTransferMap[dexInfo.programId];
            if (TransferParserClass) {
              const parser = new TransferParserClass(adapter, dexInfo, transferActions, classifiedInstructions);
              result.transfers.push(...parser.processTransfers());
            }
          }
          if (result.transfers.length == 0) {
            result.transfers.push(...Object.values(transferActions).flat());
          }
        }
      }

      // Process more events if needed
      this.processMoreEvents(parseType, result, allProgramIds, adapter, transferActions, classifier);
    } catch (error) {
      if (config.thorwError) {
        throw error;
      }
      const msg = `Parse error: ${tx?.transaction?.signatures?.[0]} ${error}`;
      result.state = false;
      result.msg = msg;
    }

    return result;
  }

  private processMoreEvents(
    parseType: string,
    result: ParseResult,
    allProgramIds: string[],
    adapter: TransactionAdapter,
    transferActions: Record<string, TransferData[]>,
    classifier: InstructionClassifier
  ) {
    if (parseType === 'all') {
      if (allProgramIds.includes(DEX_PROGRAMS.PUMP_FUN.id)) {
        result.moreEvents[DEX_PROGRAMS.PUMP_FUN.name] = new PumpfunEventParser(adapter).parseInstructions(
          classifier.getInstructions(DEX_PROGRAMS.PUMP_FUN.id)
        );
      }

      if (allProgramIds.includes(DEX_PROGRAMS.PUMP_SWAP.id)) {
        result.moreEvents[DEX_PROGRAMS.PUMP_SWAP.name] = new PumpswapEventParser(adapter).parseInstructions(
          classifier.getInstructions(DEX_PROGRAMS.PUMP_SWAP.id)
        );
      }


      if (allProgramIds.includes(DEX_PROGRAMS.RAYDIUM_LCP.id)) {
        result.moreEvents[DEX_PROGRAMS.RAYDIUM_LCP.name] = new RaydiumLaunchpadEventParser(adapter).parseInstructions(
          classifier.getInstructions(DEX_PROGRAMS.RAYDIUM_LCP.id)
        );
      }
    }
  }

  /**
   * format tradeinfo to resswapstruct
   * @param tradeinfo TradeInfo
   * @returns ResSwapStruct
   */
  public async formatTradeSwap(tradeinfo: TradeInfo): Promise<ResSwapStruct> {
    // 解析 idx 获取 id，格式通常是 "outerIndex-innerIndex"
    const parseId = (idx: string): number => {
      const parts = idx.split('-');
      return parseInt(parts[0]) || 0;
    };

    //todo
    const getPoolAddress = (tradeinfo: TradeInfo): string => {
      // 对于不同协议，可能有不同的方式获取池地址
      switch (tradeinfo.amm) {
        case 'Pumpswap':
          // Pumpswap 可能需要从 moreEvents 获取
          return '';
        case 'Pumpfun':
          // Pumpfun 使用 bonding curve 地址
          return '';
        default:
          return '';
      }
    };

    const getTokenSymbol = async (mint: string): Promise<string> => {
      // 这里可以添加代币符号映射逻辑
      // 或者从token metadata服务获取
      const tokenInfo = await getTokenInfoUseCache(mint);
      return tokenInfo?.symbol || '';
    };

    // 计算路由数量
    const getRouteCount = (tradeinfo: TradeInfo): number => {
      if (tradeinfo.amms && tradeinfo.amms.length > 0) {
        return tradeinfo.amms.length;
      }
      return tradeinfo.route ? 1 : 0;
    };

    // 判断是否直接路由
    const isDirectRoute = (tradeinfo: TradeInfo): boolean => {
      // 如果没有路由或只有一个AMM，认为是直接路由
      return !tradeinfo.route || getRouteCount(tradeinfo) <= 1;
    };

    // 计算手续费金额
    const getFeeAmount = (tradeinfo: TradeInfo): number => {
      if (tradeinfo.fee) {
        return tradeinfo.fee.amount;
      }
      if (tradeinfo.fees && tradeinfo.fees.length > 0) {
        return tradeinfo.fees.reduce((total, fee) => total + fee.amount, 0);
      }
      return 0;
    };

    // 获取处理状态
    const getStatus = (tradeinfo: TradeInfo): string => {
      // 如果有交易数据，默认认为成功
      return 'SUCCESS';
    };

    return {
      id: parseId(tradeinfo.idx),
      transaction_signature: tradeinfo.signature,
      block_time: tradeinfo.timestamp,
      slot: tradeinfo.slot,
      user_address: tradeinfo.user,
      protocol: tradeinfo.amm || '',
      pool_address: getPoolAddress(tradeinfo),
      token_in_mint: tradeinfo.inputToken.mint,
      token_out_mint: tradeinfo.outputToken.mint,
      token_in_amount: tradeinfo.inputToken.amount,
      token_out_amount: tradeinfo.outputToken.amount,
      token_in_amount_raw: parseInt(tradeinfo.inputToken.amountRaw),
      token_out_amount_raw: parseInt(tradeinfo.outputToken.amountRaw),
      token_in_symbol: await getTokenSymbol(tradeinfo.inputToken.mint),
      token_out_symbol: await getTokenSymbol(tradeinfo.outputToken.mint),
      token_in_decimals: tradeinfo.inputToken.decimals,
      token_out_decimals: tradeinfo.outputToken.decimals,
      usd_value: 0, //todo
      price_impact: 0, //todo
      fee_amount: getFeeAmount(tradeinfo),
      is_direct_route: isDirectRoute(tradeinfo),
      route_count: getRouteCount(tradeinfo),
      status: getStatus(tradeinfo),
      error_message: '', // 如果有错误信息可以添加
      raw_data: '',//JSON.stringify(tradeinfo), // 保存原始数据
      processed_at: Date.now(), // 当前处理时间
    };
  }

  /**
   * Enhanced format method with protocol-specific handling
   * 根据不同协议进行特殊处理的增强格式化方法
   */
  public async formatTradeSwapWithProtocol(tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): Promise<ResSwapStruct> {
    const baseResult =await this.formatTradeSwap(tradeinfo);

    // 根据不同协议进行特殊处理
    switch (tradeinfo.amm) {
      case 'Pumpswap':
        return this.enhancePumpswapData(baseResult, tradeinfo, moreEvents);
      case 'Pumpfun':
        return this.enhancePumpfunData(baseResult, tradeinfo, moreEvents);
      case 'Jupiter':
      case 'JupiterV2':
      case 'JupiterV4':
      case 'JupiterDCA':
      case 'JupiterLimit':
      case 'JupiterLimitV2':
      case 'JupiterVA':
        return this.enhanceJupiterData(baseResult, tradeinfo, moreEvents);
      case 'RaydiumV4':
      case 'RaydiumCPMM':
      case 'RaydiumCL':
      case 'RaydiumLaunchpad':
      case 'RaydiumRoute':
        return this.enhanceRaydiumData(baseResult, tradeinfo, moreEvents);
      case 'MeteoraDLMM':
      case 'MeteoraPools':
      case 'MeteoraDammV2':
        return this.enhanceMeteoraData(baseResult, tradeinfo, moreEvents);
      case 'Orca':
      case 'OrcaV1':
      case 'OrcaV2':
        return this.enhanceOrcaData(baseResult, tradeinfo, moreEvents);
      case 'BananaGun':
      case 'Mintech':
      case 'Bloom':
      case 'Maestro':
      case 'Nova':
      case 'Apepro':
        return this.enhanceBotData(baseResult, tradeinfo, moreEvents);
      default:
        return baseResult;
    }
  }

  /**
   * Enhance Pumpswap data
   */
  private enhancePumpswapData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    if (moreEvents && moreEvents['Pumpswap'] && moreEvents['Pumpswap'].length > 0) {
      const pumpswapEvent = moreEvents['Pumpswap'][0];
      if (pumpswapEvent.data) {
        baseResult.pool_address = pumpswapEvent.data.pool || '';
        //todo
        if (pumpswapEvent.data.poolBaseTokenReserves && pumpswapEvent.data.poolQuoteTokenReserves) {
          //todo
          baseResult.price_impact = this.calculatePriceImpact(
            BigInt(pumpswapEvent.data.poolBaseTokenReserves),
            BigInt(pumpswapEvent.data.poolQuoteTokenReserves),
            BigInt(tradeinfo.inputToken.amountRaw),
            BigInt(tradeinfo.outputToken.amountRaw)
          );
        }
      }
    }
    return baseResult;
  }

  /**
   * Enhance Pumpfun data
   */
  private enhancePumpfunData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // Pumpfun 特殊处理
    if (moreEvents && moreEvents['Pumpfun']) {
      // 从事件数据中获取更多信息
      const pumpfunEvent = moreEvents['Pumpfun'][0];
      if (pumpfunEvent?.data) {
        // Pumpfun 的 bonding curve 地址可能作为池地址
        baseResult.pool_address = pumpfunEvent.data.bondingCurve || '';
      }
    }
    baseResult.is_direct_route = true; // Pumpfun 通常是直接路由
    return baseResult;
  }

  /**
   * Enhance Jupiter data
   */
  private enhanceJupiterData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // Jupiter 聚合器处理
    baseResult.is_direct_route = false; // Jupiter 通常不是直接路由
    if (tradeinfo.amms) {
      baseResult.route_count = tradeinfo.amms.length;
      // 如果有多个AMM，设置协议为聚合
      if (tradeinfo.amms.length > 1) {
        baseResult.protocol = `${tradeinfo.amm} (${tradeinfo.amms.join(', ')})`;
      }
    }

    // DCA 特殊处理
    if (tradeinfo.amm?.includes('DCA')) {
      baseResult.protocol = tradeinfo.amm;
      baseResult.is_direct_route = true;
    }

    return baseResult;
  }

  /**
   * Enhance Raydium data
   */
  private enhanceRaydiumData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // Raydium 特殊处理
    if (moreEvents && moreEvents['RaydiumLaunchpad']) {
      const raydiumEvent = moreEvents['RaydiumLaunchpad'][0];
      if (raydiumEvent?.data) {
        baseResult.pool_address = raydiumEvent.data.poolState || '';
      }
    }

    // 根据不同的 Raydium 版本设置特定信息
    switch (tradeinfo.amm) {
      case 'RaydiumV4':
        baseResult.is_direct_route = true;
        break;
      case 'RaydiumCL':
        baseResult.is_direct_route = true;
        // 集中流动性可能有滑点信息
        break;
      case 'RaydiumCPMM':
        baseResult.is_direct_route = true;
        break;
      case 'RaydiumRoute':
        baseResult.is_direct_route = false;
        break;
    }

    return baseResult;
  }

  /**
   * Enhance Meteora data
   */
  private enhanceMeteoraData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // Meteora 特殊处理
    baseResult.is_direct_route = true; // Meteora 通常是直接路由

    // 根据不同的 Meteora 版本设置特定信息
    switch (tradeinfo.amm) {
      case 'MeteoraDLMM':
        // 动态流动性做市商
        break;
      case 'MeteoraPools':
        // 稳定币池
        break;
      case 'MeteoraDammV2':
        // 动态AMM
        break;
    }

    return baseResult;
  }

  /**
   * Enhance Orca data
   */
  private enhanceOrcaData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // Orca 特殊处理
    baseResult.is_direct_route = true; // Orca 通常是直接路由
    return baseResult;
  }

  /**
   * Enhance Bot data (trading bots)
   */
  private enhanceBotData(baseResult: ResSwapStruct, tradeinfo: TradeInfo, moreEvents?: Record<string, any[]>): ResSwapStruct {
    // 交易机器人特殊处理
    baseResult.is_direct_route = false; // 机器人通常通过其他DEX执行
    baseResult.route_count = tradeinfo.amms ? tradeinfo.amms.length : 1;

    // 添加机器人标识
    baseResult.protocol = `${baseResult.protocol} (Bot)`;

    return baseResult;
  }

  /**
   * Calculate price impact (简单实现示例)
   */
  private calculatePriceImpact(
    poolBaseReserves: bigint,
    poolQuoteReserves: bigint,
    inputAmount: bigint,
    outputAmount: bigint
  ): number {
    try {
      // 简单的价格影响计算
      // price_before = poolQuoteReserves / poolBaseReserves
      // price_after = (poolQuoteReserves - outputAmount) / (poolBaseReserves + inputAmount)
      // price_impact = (price_before - price_after) / price_before * 100

      const priceBefore = Number(poolQuoteReserves) / Number(poolBaseReserves);
      const priceAfter = Number(poolQuoteReserves - outputAmount) / Number(poolBaseReserves + inputAmount);
      const priceImpact = Math.abs((priceBefore - priceAfter) / priceBefore) * 100;

      return Math.min(priceImpact, 100); // 限制最大100%
    } catch (error) {
      return 0;
    }
  }

  /**
   * 便捷方法：直接从 ParseResult 格式化所有交易
   */
  public async formatAllTrades(parseResult: ParseResult): Promise<ResSwapStruct[]> {
    const trades = await Promise.all(
        parseResult.trades.map(trade =>
            this.formatTradeSwapWithProtocol(trade, parseResult.moreEvents)
        )
    );
    return trades;
  }

  /**
   * 处理解析结果，补充tokens、tokenPrices和userTradingSummary信息
   */
  public async enhanceParseResult(parseResult: ParseResult): Promise<ParseResult> {
    // 处理token信息
    parseResult.result.tokens = this.extractTokenMetadata(parseResult);

    // 处理token价格
    parseResult.result.tokenPrices = this.calculateTokenPrices(parseResult);

    // 处理用户交易汇总
    parseResult.result.userTradingSummary = this.generateUserTradingSummary(parseResult);

    // 格式化交易数据
    parseResult.result.trades =await this.formatAllTrades(parseResult);

    return parseResult;
  }

  /**
   * 从解析结果中提取token元数据
   */
  private extractTokenMetadata(parseResult: ParseResult): any[] {
    const tokenMap = new Map<string, any>();

    // 从交易中提取token信息
    parseResult.trades.forEach(trade => {
      // 处理输入token
      if (!tokenMap.has(trade.inputToken.mint)) {
        tokenMap.set(trade.inputToken.mint, {
          mint: trade.inputToken.mint,
          name: this.getTokenName(trade.inputToken.mint, parseResult.moreEvents),
          symbol: this.getTokenSymbolWithEvents(trade.inputToken.mint, parseResult.moreEvents),
          decimals: trade.inputToken.decimals,
          icon_url: this.getTokenIconUrl(trade.inputToken.mint, parseResult.moreEvents),
          url: '',
          total_supply: 0,
          first_seen_timestamp: parseResult.trades[0]?.timestamp || Date.now(),
          last_updated_timestamp: Date.now(),
        });
      }

      // 处理输出token
      if (!tokenMap.has(trade.outputToken.mint)) {
        tokenMap.set(trade.outputToken.mint, {
          mint: trade.outputToken.mint,
          name: this.getTokenName(trade.outputToken.mint, parseResult.moreEvents),
          symbol: this.getTokenSymbolWithEvents(trade.outputToken.mint, parseResult.moreEvents),
          decimals: trade.outputToken.decimals,
          icon_url: this.getTokenIconUrl(trade.outputToken.mint, parseResult.moreEvents),
          url: '',
          total_supply: 0,
          first_seen_timestamp: parseResult.trades[0]?.timestamp || Date.now(),
          last_updated_timestamp: Date.now(),
        });
      }
    });

    return Array.from(tokenMap.values());
  }

  /**
   * 计算token价格
   */
  private calculateTokenPrices(parseResult: ParseResult): any[] {
    const prices: any[] = [];
    const timestamp = parseResult.trades[0]?.timestamp || Date.now();

    parseResult.trades.forEach(trade => {
      // 计算token相对于SOL的价格
      const solMint = 'So11111111111111111111111111111111111111112';

      if (trade.inputToken.mint === solMint) {
        // SOL -> Token 交易，计算token价格
        const tokenPrice = this.calculateTokenPrice(
          trade.inputToken.amount,
          trade.outputToken.amount,
          trade.outputToken.mint,
          parseResult.moreEvents
        );

        if (tokenPrice) {
          prices.push({
            mint: trade.outputToken.mint,
            timestamp: timestamp,
            price_usd: 0, // 需要外部价格服务
            price_sol: tokenPrice.price_sol,
            liquidity_usd: 0, // 需要计算
            volume_24h: 0, // 需要聚合数据
            source_pool: tokenPrice.source_pool,
          });
        }
      } else if (trade.outputToken.mint === solMint) {
        // Token -> SOL 交易，计算token价格
        const tokenPrice = this.calculateTokenPrice(
          trade.outputToken.amount,
          trade.inputToken.amount,
          trade.inputToken.mint,
          parseResult.moreEvents
        );

        if (tokenPrice) {
          prices.push({
            mint: trade.inputToken.mint,
            timestamp: timestamp,
            price_usd: 0, // 需要外部价格服务
            price_sol: tokenPrice.price_sol,
            liquidity_usd: 0, // 需要计算
            volume_24h: 0, // 需要聚合数据
            source_pool: tokenPrice.source_pool,
          });
        }
      }
    });

    return prices;
  }

  /**
   * 计算单个token的价格
   */
  private calculateTokenPrice(
    solAmount: number,
    tokenAmount: number,
    tokenMint: string,
    moreEvents: Record<string, any[]>
  ): { price_sol: number; source_pool: string } | null {
    if (tokenAmount === 0) return null;

    // 基础价格计算
    const price_sol = solAmount / tokenAmount;

    // 尝试从更多事件中获取池信息
    let source_pool = '';

    // Pumpfun 事件处理
    if (moreEvents['Pumpfun']) {
      const pumpfunEvents = moreEvents['Pumpfun'];
      const tradeEvent = pumpfunEvents.find(e =>
        e.type === 'TRADE' && e.data?.mint === tokenMint
      );
      if (tradeEvent?.data) {
        source_pool = tradeEvent.data.bondingCurve || '';
      }
    }

    // Pumpswap 事件处理
    if (moreEvents['Pumpswap']) {
      const pumpswapEvents = moreEvents['Pumpswap'];
      const swapEvent = pumpswapEvents.find(e =>
        (e.type === 'BUY' || e.type === 'SELL') && e.data?.pool
      );
      if (swapEvent?.data) {
        source_pool = swapEvent.data.pool;
      }
    }

    return { price_sol, source_pool };
  }

  /**
   * 生成用户交易汇总
   */
  private generateUserTradingSummary(parseResult: ParseResult): any[] {
    const userSummaryMap = new Map<string, any>();
    const periodEnd = Date.now();
    const periodType = 'daily';

    parseResult.trades.forEach(trade => {
      const userAddress = trade.user;

      if (!userSummaryMap.has(userAddress)) {
        userSummaryMap.set(userAddress, {
          user_address: userAddress,
          period_end: periodEnd,
          period_type: periodType,
          total_swaps: 0,
          unique_tokens_bought: new Set<string>(),
          unique_tokens_sold: new Set<string>(),
          total_volume_usd: 0,
          avg_swap_size_usd: 0,
          profit_usd: 0,
        });
      }

      const summary = userSummaryMap.get(userAddress)!;
      summary.total_swaps++;

      if (trade.type === 'BUY') {
        summary.unique_tokens_bought.add(trade.outputToken.mint);
      } else {
        summary.unique_tokens_sold.add(trade.inputToken.mint);
      }

      // 这里需要价格信息来计算USD值
      // summary.total_volume_usd += calculateUsdValue(trade);
    });

    // 转换并计算最终统计
    return Array.from(userSummaryMap.values()).map(summary => ({
      user_address: summary.user_address,
      period_end: summary.period_end,
      period_type: summary.period_type,
      total_swaps: summary.total_swaps,
      unique_tokens_bought: summary.unique_tokens_bought.size,
      unique_tokens_sold: summary.unique_tokens_sold.size,
      total_volume_usd: summary.total_volume_usd,
      avg_swap_size_usd: summary.total_swaps > 0 ? summary.total_volume_usd / summary.total_swaps : 0,
      profit_usd: summary.profit_usd,
    }));
  }

  /**
   * 获取token名称
   */
  private getTokenName(mint: string, moreEvents: Record<string, any[]>): string {
    // SOL token
    if (mint === 'So11111111111111111111111111111111111111112') {
      return 'Solana';
    }

    // 从Pumpfun CREATE事件获取
    if (moreEvents['Pumpfun']) {
      const createEvent = moreEvents['Pumpfun'].find(e =>
        e.type === 'CREATE' && e.data?.mint === mint
      );
      if (createEvent?.data?.name) {
        return createEvent.data.name;
      }
    }

    return 'Unknown Token';
  }

  /**
   * 获取token符号
   */
  private getTokenSymbol(mint: string): string {
    // 这里可以添加代币符号映射逻辑
    // 或者从token metadata服务获取
    return '';
  }

  /**
   * 获取token符号（带事件数据）
   */
  private getTokenSymbolWithEvents(mint: string, moreEvents: Record<string, any[]>): string {
    // SOL token
    if (mint === 'So11111111111111111111111111111111111111112') {
      return 'SOL';
    }

    // 从Pumpfun CREATE事件获取
    if (moreEvents['Pumpfun']) {
      const createEvent = moreEvents['Pumpfun'].find(e =>
        e.type === 'CREATE' && e.data?.mint === mint
      );
      if (createEvent?.data?.symbol) {
        return createEvent.data.symbol;
      }
    }

    return mint.slice(0, 6); // 使用mint地址前6位作为fallback
  }

  /**
   * todo 获取token图标URL
   */
  private getTokenIconUrl(mint: string, moreEvents: Record<string, any[]>): string {
    if (moreEvents['Pumpfun']) {
      const createEvent = moreEvents['Pumpfun'].find(e =>
        e.type === 'CREATE' && e.data?.mint === mint
      );

      //todo 这里需要对uri进行进一步解析 对于pump代币来说 这个uri内存放的是metadata 所以这里不能直接视为token
      if (createEvent?.data?.uri) {
        return createEvent.data.uri;
      }
    }

    return '';
  }


  /**
   * 处理流动性数据
   */
  private enhanceLiquidityData(parseResult: ParseResult): ParseResult {
    // 处理现有的流动性事件，根据PoolEvent的实际结构进行映射
    parseResult.result.liquidities = parseResult.liquidities.map(liquidity => {
      return {
        pool_address: liquidity.poolId || '',
        protocol: liquidity.amm || '',
        token_a_mint: liquidity.token0Mint || '',
        token_b_mint: liquidity.token1Mint || '',
        token_a_symbol: this.getTokenSymbolWithEvents(liquidity.token0Mint || '', parseResult.moreEvents),
        token_b_symbol: this.getTokenSymbolWithEvents(liquidity.token1Mint || '', parseResult.moreEvents),
        token_a_amount: liquidity.token0Amount || 0,
        token_b_amount: liquidity.token1Amount || 0,
        liquidity_usd: 0, //todo
        fee_rate: 0, // 需要从事件数据获取
        is_verified: false, // 需要验证逻辑
        created_timestamp: liquidity.timestamp || Date.now(),
        last_updated_timestamp: Date.now(),
      };
    });

    // 从CREATE事件中提取新创建的流动性池信息
    this.extractLiquidityFromCreateEvents(parseResult);

    return parseResult;
  }

  /**
   * 从CREATE事件中提取流动性池信息
   */
  private extractLiquidityFromCreateEvents(parseResult: ParseResult): void {
    // 处理Pumpfun CREATE事件
    if (parseResult.moreEvents['Pumpfun']) {
      const createEvents = parseResult.moreEvents['Pumpfun'].filter(e => e.type === 'CREATE');

      createEvents.forEach(createEvent => {
        if (createEvent.data) {
          const liquidityInfo = {
            pool_address: createEvent.data.bondingCurve || '',
            protocol: 'Pumpfun',
            token_a_mint: createEvent.data.mint || '',
            token_b_mint: 'So11111111111111111111111111111111111111112', // SOL
            token_a_symbol: createEvent.data.symbol || '',
            token_b_symbol: 'SOL',
            token_a_amount: 0, // 初始创建时通常为0
            token_b_amount: 0,
            liquidity_usd: 0,
            fee_rate: 0, // Pumpfun的手续费率
            is_verified: false,
            created_timestamp: createEvent.timestamp || Date.now(),
            last_updated_timestamp: Date.now(),
          };

          parseResult.result.liquidities.push(liquidityInfo);
        }
      });
    }

    // 处理Pumpswap CREATE事件
    if (parseResult.moreEvents['Pumpswap']) {
      const createEvents = parseResult.moreEvents['Pumpswap'].filter(e => e.type === 'CREATE');

      createEvents.forEach(createEvent => {
        if (createEvent.data) {
          const liquidityInfo = {
            pool_address: createEvent.data.pool || '',
            protocol: 'Pumpswap',
            token_a_mint: createEvent.data.baseMint || '',
            token_b_mint: createEvent.data.quoteMint || '',
            token_a_symbol: this.getTokenSymbolWithEvents(createEvent.data.baseMint || '', parseResult.moreEvents),
            token_b_symbol: this.getTokenSymbolWithEvents(createEvent.data.quoteMint || '', parseResult.moreEvents),
            token_a_amount: Number(createEvent.data.baseAmountIn || 0),
            token_b_amount: Number(createEvent.data.quoteAmountIn || 0),
            liquidity_usd: 0,
            fee_rate: 0.003, // 0.3% Pumpswap默认手续费率
            is_verified: false,
            created_timestamp: createEvent.timestamp || Date.now(),
            last_updated_timestamp: Date.now(),
          };

          parseResult.result.liquidities.push(liquidityInfo);
        }
      });
    }
  }

  /**
   * 增强版处理解析结果，包含流动性数据
   */
  public async enhanceParseResultComplete(parseResult: ParseResult): Promise<ParseResult> {
    // 处理token信息
    parseResult.result.tokens = this.extractTokenMetadata(parseResult);

    // 处理token价格
    parseResult.result.tokenPrices = this.calculateTokenPrices(parseResult);

    // 处理用户交易汇总
    parseResult.result.userTradingSummary = this.generateUserTradingSummary(parseResult);

    // 处理流动性数据
    this.enhanceLiquidityData(parseResult);

    // 格式化交易数据
    parseResult.result.trades = await this.formatAllTrades(parseResult);

    return parseResult;
  }

  /**
   * 最完整的解析方法，包含所有增强功能
   */
  public async parseAllComplete(tx: SolanaTransaction, config?: ParseConfig): Promise<ParseResult> {
    const parseResult = this.parseWithClassifier(tx, config, 'all');
    return this.enhanceParseResultComplete(parseResult);
  }

  /**
   * Parse trades from transaction
   */
  public parseTrades(tx: SolanaTransaction, config?: ParseConfig): TradeInfo[] {
    return this.parseWithClassifier(tx, config, 'trades').trades;
  }

  /**
   * Parse liquidity events from transaction
   */
  public parseLiquidity(tx: SolanaTransaction, config?: ParseConfig): PoolEvent[] {
    return this.parseWithClassifier(tx, config, 'liquidity').liquidities;
  }

  /**
   * Parse transfers from transaction (if no trades and no liquidity)
   */
  public parseTransfers(tx: SolanaTransaction, config?: ParseConfig): TransferData[] {
    return this.parseWithClassifier(tx, config, 'transfer').transfers;
  }

  /**
   * Parse both trades and liquidity events from transaction
   */
  public parseAll(tx: SolanaTransaction, config?: ParseConfig): ParseResult {
    return this.parseWithClassifier(tx, config, 'all');
  }


  public async parsePerBlock(blockNumber: number, config?: ParseConfig): Promise<ParseResult[]> {
    let start= Date.now();
    let transactions = await getBlockValue(blockNumber);
    console.log(`fetch block ${blockNumber},cost:${Date.now() - start} ms`);
    if (transactions) {
      start= Date.now();
      const validTransactions = transactions.transactions.filter(tx => !tx.meta?.err);
      const parseResult = await Promise.all(
          validTransactions.map((transaction) =>
              this.parseAllComplete({
                ...transaction,
                blockTime: transactions.blockTime,
                slot: blockNumber,
                transaction: transaction.transaction,
              })
          )
      );
      console.log(`parse block ${blockNumber},cost:${Date.now() - start} ms`);
      return parseResult;
    }
    return [];
  }

  public async parseBlockData(blockData:VersionedBlockResponse,blockNumber: number): Promise<ParseResult[]> {
    let start= Date.now();
    const validTransactions = blockData.transactions.filter(tx => !tx.meta?.err);
    const parseResult = await Promise.all(
        validTransactions.map((transaction) =>
            this.parseAllComplete({
              ...transaction,
              blockTime: blockData.blockTime,
              slot: blockNumber,
              transaction: transaction.transaction,
            })
        )
    );
    console.log(`parse block ${blockNumber},cost:${Date.now() - start} ms`);
    return parseResult;
  }
}
export const exportDexparserInstance = new DexParser();


