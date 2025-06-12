import { Idl } from "npm:@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { IDL as PumpIdl } from "./idl/pump-fun.ts"; // IDL 文件
import { SolanaOnChainDataStruct } from "../../../type/transaction.ts";

const rpcConnection = new Connection("https://api.mainnet-beta.solana.com");
const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// 创建兼容的 IDL
const compatibleIdl = {
    ...PumpIdl,
    address: PUMP_FUN_PROGRAM_ID,
    metadata: {
        name: "pump_fun",
        version: "0.1.0",
        spec: "0.1.0"
    }
} as unknown as Idl;

// 初始化解析器
const txParser = new SolanaParser([{
    idl: compatibleIdl,
    programId: PUMP_FUN_PROGRAM_ID
}]);

// 解析 Pump Fun 交易的主函数
export const parsePumpFunTransaction = async (
    transactionSignature: string,
    connection?: Connection
): Promise<any> => {
    const conn = connection || rpcConnection;
    
    try {
        const parsed = await txParser.parseTransaction(
            conn,
            transactionSignature,
            false, // 是否包含失败的交易
        );
        
        return parsed;
    } catch (error) {
        console.error('解析交易失败:', error);
        throw error;
    }
};

// 从现有交易数据中解析（推荐方法）
export const parsePumpFunTransactionFromData = (
    transactionData: SolanaOnChainDataStruct
): any => {
    try {
        // 解析交易数据中的指令
        const parsed = txParser.parseTransactionData(
            transactionData.transaction.message,
            transactionData.meta.loadedAddresses || { writable: [], readonly: [] }
        );
        
        // 如果需要解析内部指令
        const parsedInnerIxs = txParser.parseTransactionWithInnerInstructions(transactionData);
        
        return {
            instructions: parsed,
            innerInstructions: parsedInnerIxs,
            transaction: transactionData
        };
    } catch (error) {
        console.error('解析交易数据失败:', error);
        throw error;
    }
};

// 提取 Pump Fun 的 create 指令
export const extractCreateInstruction = (parsedTransaction: any) => {
    if (!parsedTransaction.instructions) {
        return null;
    }
    
    return parsedTransaction.instructions.find((ix: any) => 
        ix.name === 'create' && 
        ix.programId === PUMP_FUN_PROGRAM_ID
    );
};

// 提取 Pump Fun 的 buy 指令
export const extractBuyInstruction = (parsedTransaction: any) => {
    if (!parsedTransaction.instructions) {
        return null;
    }
    
    return parsedTransaction.instructions.find((ix: any) => 
        ix.name === 'buy' && 
        ix.programId === PUMP_FUN_PROGRAM_ID
    );
};

// 提取 Pump Fun 的 sell 指令
export const extractSellInstruction = (parsedTransaction: any) => {
    if (!parsedTransaction.instructions) {
        return null;
    }
    
    return parsedTransaction.instructions.find((ix: any) => 
        ix.name === 'sell' && 
        ix.programId === PUMP_FUN_PROGRAM_ID
    );
};

// 导出解析器实例供其他地方使用
export { txParser };