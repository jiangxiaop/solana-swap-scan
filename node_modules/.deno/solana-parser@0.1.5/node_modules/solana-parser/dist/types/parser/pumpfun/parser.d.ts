import { ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { BaseParser } from '../../core/base';
import { PumpFunTransaction } from './types';
export declare class PumpFunParser implements BaseParser<PumpFunTransaction> {
    private readonly discriminators;
    readonly PROGRAM_ID: PublicKey;
    private decodeEvent;
    parse(transaction: ParsedTransactionWithMeta): PumpFunTransaction;
    parseMultiple(transactions: ParsedTransactionWithMeta[]): PumpFunTransaction[];
}
//# sourceMappingURL=parser.d.ts.map