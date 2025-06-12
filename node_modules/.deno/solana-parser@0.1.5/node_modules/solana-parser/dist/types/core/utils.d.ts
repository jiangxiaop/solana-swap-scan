import { ParsedInstruction, ParsedTransactionWithMeta, PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js';
export declare const anchorLogScanner: (logs: string[], programId: string) => string[];
export declare const createAnchorSigHash: (sig: string) => Buffer;
export declare const flattenTransactionInstructions: (transaction: ParsedTransactionWithMeta) => (ParsedInstruction | PartiallyDecodedInstruction)[];
export declare const getAccountSOLBalanceChange: (transaction: ParsedTransactionWithMeta, account: PublicKey) => number;
export declare const getSplTransfers: (instructions: (ParsedInstruction | PartiallyDecodedInstruction)[]) => (ParsedInstruction | PartiallyDecodedInstruction)[];
export declare const getSOLTransfers: (instructions: (ParsedInstruction | PartiallyDecodedInstruction)[]) => (ParsedInstruction | PartiallyDecodedInstruction)[];
//# sourceMappingURL=utils.d.ts.map