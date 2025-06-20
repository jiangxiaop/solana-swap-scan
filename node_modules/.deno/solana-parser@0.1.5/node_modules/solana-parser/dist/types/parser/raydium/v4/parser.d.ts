import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { AsyncBaseParser } from '../../../core/base';
import { RaydiumV4Transaction, PoolInfo } from './types';
export declare class RaydiumV4Parser implements AsyncBaseParser<RaydiumV4Transaction> {
    private poolInfoCache;
    private connection;
    constructor(rpcConnection: Connection, options: {
        maxPoolCache?: number;
    });
    getRayLogs(transaction: ParsedTransactionWithMeta): string[] | undefined;
    decodeRayLog(msg: string): {
        logType: 0;
        timestamp: bigint;
        quoteDecimals: number;
        baseDecimals: number;
        quoteLotSize: bigint;
        baseLotSize: bigint;
        quoteAmountIn: bigint;
        baseAmountIn: bigint;
        marketId: PublicKey;
    } | {
        logType: 1;
        maxBaseAmount: bigint;
        maxQuoteAmount: bigint;
        fixedSide: bigint;
        baseReserve: bigint;
        quoteReserve: bigint;
        poolLpAmount: bigint;
        pnlX: bigint;
        pnlY: bigint;
        baseAmountIn: bigint;
        quoteAmountIn: bigint;
        mintedLpAmount: bigint;
    } | {
        logType: 2;
        withdrawLpAmount: bigint;
        userLpAmount: bigint;
        baseReserve: bigint;
        quoteReserve: bigint;
        poolLpAmount: bigint;
        pnlX: bigint;
        pnlY: bigint;
        baseAmountOut: bigint;
        quoteAmountOut: bigint;
    } | {
        logType: 3;
        amountIn: bigint;
        minimumAmountOut: bigint;
        direction: bigint;
        userSource: bigint;
        baseReserve: bigint;
        quoteReserve: bigint;
        amountOut: bigint;
    } | {
        logType: 4;
        maxAmountIn: bigint;
        amountOut: bigint;
        direction: bigint;
        userSource: bigint;
        baseReserve: bigint;
        quoteReserve: bigint;
        amountIn: bigint;
    } | null;
    getPoolInfo(poolId: string): Promise<PoolInfo | null>;
    private handleSwap;
    private handleCreatePool;
    private handleDeposit;
    private handleWithdraw;
    parse(transaction: ParsedTransactionWithMeta): Promise<RaydiumV4Transaction | null>;
    parseMultiple(transactions: ParsedTransactionWithMeta[]): Promise<RaydiumV4Transaction[] | null>;
}
//# sourceMappingURL=parser.d.ts.map