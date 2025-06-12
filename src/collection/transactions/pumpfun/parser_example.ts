import { Idl } from "npm:@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { IDL as PumpIdl } from "./idl/pump-fun.ts";

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

// 示例：使用交易签名解析
export const parseBySignature = async (signature: string) => {
    try {
        const connection = new Connection("https://api.mainnet-beta.solana.com");
        
        console.log(`开始解析交易: ${signature}`);
        
        const parsed = await txParser.parseTransaction(
            connection,
            signature,
            false // 不包含失败的交易
        );
        
        console.log("解析结果:", parsed);
        
        // 查找 Pump Fun 相关指令
        const createInstruction = parsed?.find((ix: any) => ix.name === 'create');
        const buyInstruction = parsed?.find((ix: any) => ix.name === 'buy');
        
        if (createInstruction) {
            console.log("找到创建代币指令:", createInstruction);
            console.log("代币名称:", createInstruction.args?.name);
            console.log("代币符号:", createInstruction.args?.symbol);
            console.log("元数据URI:", createInstruction.args?.uri);
        }
        
        if (buyInstruction) {
            console.log("找到购买指令:", buyInstruction);
            console.log("购买数量:", buyInstruction.args?.amount);
            console.log("最大SOL成本:", buyInstruction.args?.maxSolCost);
        }
        
        return {
            parsed,
            createInstruction,
            buyInstruction
        };
        
    } catch (error) {
        console.error("解析失败:", error);
        throw error;
    }
};

// 从测试数据中提取关键信息
export const extractTokenInfoFromLogs = (transactionData: any) => {
    const { meta } = transactionData;
    
    console.log("开始从日志中提取代币信息...");
    
    // 查找包含 Program data 的日志
    const metadataLog = meta.logMessages.find((log: string) => log.includes('Program data:'));
    
    if (!metadataLog) {
        console.log("未找到包含代币元数据的日志");
        return null;
    }
    
    console.log("找到元数据日志:", metadataLog);
    
    // 提取 base64 数据
    const dataLine = metadataLog.split('Program data: ')[1];
    
    if (!dataLine) {
        console.log("无法提取数据部分");
        return null;
    }
    
    try {
        // 解码 base64 数据
        const buffer = Buffer.from(dataLine, 'base64');
        const plainText = buffer.toString('utf8');
        
        console.log("解码后的数据:", plainText);
        
        // 提取代币地址（从 postTokenBalances 中获取）
        let tokenAddress = '';
        if (meta.postTokenBalances && meta.postTokenBalances.length > 0) {
            tokenAddress = meta.postTokenBalances[0].mint;
        }
        
        // 简单的模式匹配来提取信息
        // 这里可能需要根据实际的数据格式进行调整
        const nameMatch = plainText.match(/([a-zA-Z]{2,20})/);
        const symbolMatch = plainText.match(/([A-Z]{2,10})/);
        const urlMatch = plainText.match(/(https?:\/\/[^\s]+)/);
        
        const tokenInfo = {
            address: tokenAddress,
            name: nameMatch ? nameMatch[1] : '',
            symbol: symbolMatch ? symbolMatch[1] : '',
            imageUrl: urlMatch ? urlMatch[1] : '',
            decimals: 6, // Pump Fun 通常使用 6 位小数
            rawData: plainText
        };
        
        console.log("提取的代币信息:", tokenInfo);
        return tokenInfo;
        
    } catch (error) {
        console.error("解码数据失败:", error);
        return null;
    }
};

// 解析交易中的账户和金额变化
export const analyzeTransactionChanges = (transactionData: any) => {
    const { meta, transaction } = transactionData;
    
    console.log("分析交易变化...");
    
    const analysis = {
        solChanges: [] as Array<{account: string, before: number, after: number, change: number}>,
        tokenChanges: [] as Array<{account: string, mint: string, before: string, after: string, change: string}>,
        newAccounts: [] as string[],
        instructions: [] as Array<{program: string, accounts: string[]}>
    };
    
    // 分析 SOL 余额变化
    if (meta.preBalances && meta.postBalances) {
        transaction.message.accountKeys.forEach((account: string, index: number) => {
            const before = meta.preBalances[index] / 1e9; // 转换为 SOL
            const after = meta.postBalances[index] / 1e9;
            const change = after - before;
            
            if (Math.abs(change) > 0.000001) { // 忽略微小变化
                analysis.solChanges.push({
                    account,
                    before,
                    after,
                    change
                });
            }
        });
    }
    
    // 分析代币余额变化
    if (meta.preTokenBalances && meta.postTokenBalances) {
        meta.postTokenBalances.forEach((postBalance: any) => {
            const preBalance = meta.preTokenBalances.find((pre: any) => 
                pre.accountIndex === postBalance.accountIndex
            );
            
            analysis.tokenChanges.push({
                account: transaction.message.accountKeys[postBalance.accountIndex],
                mint: postBalance.mint,
                before: preBalance ? preBalance.uiTokenAmount.uiAmountString : '0',
                after: postBalance.uiTokenAmount.uiAmountString,
                change: preBalance 
                    ? (parseFloat(postBalance.uiTokenAmount.uiAmountString) - parseFloat(preBalance.uiTokenAmount.uiAmountString)).toString()
                    : postBalance.uiTokenAmount.uiAmountString
            });
        });
    }
    
    // 查找新创建的账户
    if (meta.preBalances && meta.postBalances) {
        transaction.message.accountKeys.forEach((account: string, index: number) => {
            if (meta.preBalances[index] === 0 && meta.postBalances[index] > 0) {
                analysis.newAccounts.push(account);
            }
        });
    }
    
    // 分析指令
    transaction.message.instructions.forEach((instruction: any) => {
        const programId = transaction.message.accountKeys[instruction.programIdIndex];
        const accounts = instruction.accounts.map((accountIndex: number) => 
            transaction.message.accountKeys[accountIndex]
        );
        
        analysis.instructions.push({
            program: programId,
            accounts
        });
    });
    
    console.log("交易分析结果:", analysis);
    return analysis;
};

// 主要的演示函数
export const demonstrateParser = async (testData: any) => {
    console.log("=== Solana 交易解析演示 ===");
    
    // 1. 从日志中提取代币信息
    console.log("\n1. 从交易日志中提取代币信息:");
    const tokenInfo = extractTokenInfoFromLogs(testData);
    
    // 2. 分析交易变化
    console.log("\n2. 分析交易中的账户和余额变化:");
    const changes = analyzeTransactionChanges(testData);
    
    // 3. 如果有交易签名，尝试使用 SDK 解析
    if (testData.transaction?.signatures?.[0]) {
        console.log("\n3. 使用 SDK 解析交易:");
        try {
            const signature = testData.transaction.signatures[0];
            await parseBySignature(signature);
        } catch (error) {
            console.log("SDK 解析失败，可能是网络问题或交易太旧:", error.message);
        }
    }
    
    return {
        tokenInfo,
        changes,
        summary: {
            isPumpFunTransaction: changes.instructions.some(ix => ix.program === PUMP_FUN_PROGRAM_ID),
            hasTokenCreation: changes.newAccounts.length > 0,
            hasTokenTransfer: changes.tokenChanges.length > 0,
            totalSolChange: changes.solChanges.reduce((sum, change) => sum + Math.abs(change.change), 0)
        }
    };
};

// 导出解析器和常量
export { txParser, PUMP_FUN_PROGRAM_ID }; 