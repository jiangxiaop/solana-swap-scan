import { ConfirmedTransactionMeta, TransactionVersion, VersionedMessage } from "@solana/web3.js";

export interface TransactionInfo {
    slot: number;
    blockTime: number | null;
    blockHash: string;
    parentSlot: number;
    transactionCount: number | null;
    transactions: {
        index: number;
        signature: string;
        transaction: {
            /** The transaction */
            transaction: {
                /** The transaction message */
                message: VersionedMessage;
                /** The transaction signatures */
                signatures: string[];
            };
            /** Metadata produced from the transaction */
            meta: ConfirmedTransactionMeta | null;
            /** The transaction version */
            version?: TransactionVersion;
        };
        meta: ConfirmedTransactionMeta | null;
    }[];
}


export interface SolanaOnChainDataStruct {
    meta: {
        computeUnitsConsumed: number;
        err: null;
        fee: number;
        innerInstructions: {
            index: number;
            instructions: {
                accounts: number[];
                data: string;
            }[];
        }[];
        loadedAddresses: {
            readonly: string[];
            writable: string[];
        };
        logMessages: string[];
        postBalances: number[];
        postTokenBalances: {
            accountIndex: number;
            mint: string;
            owner: string;
            programId: string;
            uiTokenAmount: {
                amount: string;
                decimals: number;
                uiAmount: number | null;
                uiAmountString: string;
            };
        }[];
        preBalances: number[];
        preTokenBalances: {
            accountIndex: number;
            mint: string;
            owner: string;
            programId: string;
        }[];
        rewards: {
            lamports: number;
            postBalance: number;
            preBalance: number;
        }[];
        status: {
            Ok: null;
        };
    }
    transaction: {
        message: {
            header: {
                numReadonlySignedAccounts: number;
                numReadonlyUnsignedAccounts: number;
                numRequiredSignatures: number;
            };
            accountKeys: string[];
            recentBlockhash: string;
            instructions: {
                accounts: number[];
                data: string;
                programIdIndex: number;
            }[];
            indexToProgramIds: {
                [key: string]: string;
            };
        };
        signatures: string[];
        version: "legacy" | "v0";
    }
}