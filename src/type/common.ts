import { ResLpInfoStruct, ResSwapStruct, ResTokenMetadataStruct, ResTokenPriceStruct, ResUserTradingSummaryStruct } from "./filter_struct.ts";
import { PoolEvent } from './pool.ts';
import { TokenAmount, TradeInfo, TransferData } from './trade.ts';
import { Buffer } from 'node:buffer';

export interface ClassifiedInstruction {
  instruction: any;
  programId: string;
  outerIndex: number;
  innerIndex?: number;
}

export interface BalanceChange {
  pre: TokenAmount;
  post: TokenAmount;
  change: TokenAmount;
}

export interface ParseResult {
  state: boolean;
  fee: TokenAmount; // transaction gas fee
  trades: TradeInfo[];
  liquidities: PoolEvent[];
  transfers: TransferData[];
  solBalanceChange?: BalanceChange; // SOL balance change
  tokenBalanceChange?: Map<string, BalanceChange>; // token balance change, key is token mint address
  moreEvents: Record<string, any[]>; // other events, key is Amm name
  msg?: string;
  result: {
    trades: ResSwapStruct[];
    liquidities: ResLpInfoStruct[];
    tokens: ResTokenMetadataStruct[];
    tokenPrices: ResTokenPriceStruct[];
    userTradingSummary: ResUserTradingSummaryStruct[];
  }
}

export type EventParser<T> = {
  discriminator: Buffer | Uint8Array;
  decode: (data: Buffer) => T;
};

export type EventsParser<T> = {
  discriminators: (Buffer | Uint8Array)[];
  slice: number;
  decode: (data: Buffer, options: any) => T;
};
