import { Buffer } from "node:buffer";
import { demonstrateParser, extractTokenInfoFromLogs, analyzeTransactionChanges } from "./parser_example.ts";

// 从你的测试数据中导入
const testData = {
    "meta": {
        "computeUnitsConsumed": 197037,
        "err": null,
        "fee": 919000,
        "logMessages": [
            "Program 11111111111111111111111111111111 invoke [1]",
            "Program 11111111111111111111111111111111 success",
            "Program ComputeBudget111111111111111111111111111111 invoke [1]",
            "Program ComputeBudget111111111111111111111111111111 success",
            "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
            "Program log: Instruction: Create",
            "Program data: G3KpTd7rY3YGAAAAY29zdGNvBgAAAENPU1RDT0MAAABodHRwczovL2lwZnMuaW8vaXBmcy9RbWM0QnVybzdLSjV5UDRlVkpBY1lrbmtZTW1KSGlOOEhDakU1TDJDZUt6SEdhOlEIjuMgLqO9oCG/DwmmKUI6OumpYdid9c9VgKRsLPyrA5VAu/Y/pBxVz5lPWMygUNE67dUCDTCedqlFTYRUi5gcnBHWDouZ68hPeNswkhDfdiJPBamtiNdQ+uX95dwymBycEdYOi5nryE942zCSEN92Ik8Fqa2I11D65f3l3DKCEUVoAAAAAAAQ2EfjzwMAAKwj/AYAAAAAeMX7UdECAACAxqR+jQMA",
            "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
        ],
        "postTokenBalances": [
            {
                "accountIndex": 3,
                "mint": "4veK9R9GxmgxqkFhTa2VnE6MJ4YfTxnr92HF5gH5LcAF",
                "owner": "CWZtLfpfZpgyR96bwDszjC7ecm1vJQPzvvgwA5VusWZg",
                "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                "uiTokenAmount": {
                    "amount": "873764705882353",
                    "decimals": 6,
                    "uiAmount": 873764705.882353,
                    "uiAmountString": "873764705.882353"
                }
            }
        ],
        "preTokenBalances": [],
        "preBalances": [21798634015, 0, 50623244768058],
        "postBalances": [17732704615, 1461600, 50623282768058]
    },
    "transaction": {
        "message": {
            "accountKeys": [
                "BEnGowz22N6QtVdBCqG53FzYGdPhBqSZmPD3aCgnq4NM",
                "4veK9R9GxmgxqkFhTa2VnE6MJ4YfTxnr92HF5gH5LcAF",
                "62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"
            ],
            "instructions": [
                {
                    "accounts": [0, 7],
                    "data": "3Bxs46FXpav9J9So",
                    "programIdIndex": 9
                },
                {
                    "accounts": [1, 18, 6, 3, 10, 15, 4, 0, 9, 17, 12, 16, 13, 11],
                    "data": "4fEnDdscaoZLQvJGQYWBqgfPsCNWkBerTBcSoZVpLbaQ1rxvt6uYZ3CHo1UxuXEQT7cJoZir8FK3PSfTosYgJPXukAQT2bzX9xu4ez4U9yXjpSBCWMj5gAPaxuRdALpmQ3guAXntTBpTqek6Lx6S9Cm9AGJLyQKCNJQrx6C6CruprfvoXE9",
                    "programIdIndex": 11
                }
            ]
        },
        "signatures": [
            "a9tyifZay3w5j6yL7egpNxxBsQFTuvQHKf3XHjnLY2QToVDjnyT5gPLjbJ2qSXmVPGJzEpEZmgJZ6qQXS99p1JH"
        ]
    }
};

// 手动解析 Program data 中的代币信息
export const parseTokenMetadata = (base64Data: string) => {
    try {
        console.log("开始解析代币元数据...");
        
        const buffer = Buffer.from(base64Data, 'base64');
        console.log("缓冲区长度:", buffer.length);
        
        // 尝试解析不同部分
        const text = buffer.toString('utf8');
        console.log("UTF-8 文本:", text);
        
        // 查找可读的文本部分
        const readableText = text.replace(/[^\x20-\x7E]/g, ''); // 只保留可打印字符
        console.log("可读文本:", readableText);
        
        // 尝试从可读文本中提取信息
        const tokenInfo = {
            name: '',
            symbol: '',
            imageUrl: '',
            rawText: readableText
        };
        
        // 查找名称和符号
        const parts = readableText.split(/\s+/).filter(part => part.length > 0);
        console.log("文本部分:", parts);
        
        // 查找 HTTPS URL
        const urlMatch = readableText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            tokenInfo.imageUrl = urlMatch[1];
            console.log("找到图片URL:", tokenInfo.imageUrl);
        }
        
        // 简单的启发式方法来提取名称和符号
        for (const part of parts) {
            if (part.length >= 3 && part.length <= 20 && /^[a-zA-Z]+$/.test(part)) {
                if (!tokenInfo.name && part.length > 3) {
                    tokenInfo.name = part;
                } else if (!tokenInfo.symbol && part.length <= 10) {
                    tokenInfo.symbol = part;
                }
            }
        }
        
        console.log("解析的代币信息:", tokenInfo);
        return tokenInfo;
        
    } catch (error) {
        console.error("解析元数据失败:", error);
        return null;
    }
};

// 主测试函数
export const runParsingTest = async () => {
    console.log("=== 开始解析测试 ===\n");
    
    // 1. 手动解析 Program data
    console.log("1. 手动解析程序数据:");
    const metadataLog = testData.meta.logMessages.find(log => log.includes('Program data:'));
    if (metadataLog) {
        const base64Data = metadataLog.split('Program data: ')[1];
        const tokenMetadata = parseTokenMetadata(base64Data);
        console.log("解析的代币元数据:", tokenMetadata);
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // 2. 分析余额变化
    console.log("2. 分析余额变化:");
    
    const solChanges = testData.meta.preBalances.map((preBalance, index) => {
        const postBalance = testData.meta.postBalances[index];
        const change = (postBalance - preBalance) / 1e9; // 转换为 SOL
        return {
            accountIndex: index,
            account: testData.transaction.message.accountKeys[index] || `账户${index}`,
            before: preBalance / 1e9,
            after: postBalance / 1e9,
            change
        };
    }).filter(change => Math.abs(change.change) > 0.001);
    
    console.log("SOL 余额变化:");
    solChanges.forEach(change => {
        console.log(`  ${change.account}: ${change.before.toFixed(6)} → ${change.after.toFixed(6)} (${change.change > 0 ? '+' : ''}${change.change.toFixed(6)} SOL)`);
    });
    
    console.log("\n代币余额变化:");
    testData.meta.postTokenBalances.forEach(tokenBalance => {
        console.log(`  代币: ${tokenBalance.mint}`);
        console.log(`  账户: ${testData.transaction.message.accountKeys[tokenBalance.accountIndex]}`);
        console.log(`  数量: ${tokenBalance.uiTokenAmount.uiAmountString}`);
        console.log(`  小数位: ${tokenBalance.uiTokenAmount.decimals}`);
    });
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // 3. 分析指令
    console.log("3. 分析交易指令:");
    testData.transaction.message.instructions.forEach((instruction, index) => {
        console.log(`指令 ${index + 1}:`);
        console.log(`  程序索引: ${instruction.programIdIndex}`);
        console.log(`  涉及账户: ${instruction.accounts.map(acc => testData.transaction.message.accountKeys[acc] || `索引${acc}`).join(', ')}`);
        console.log(`  数据长度: ${instruction.data.length} 字符`);
    });
    
    console.log("\n" + "=".repeat(50) + "\n");
    
    // 4. 总结
    console.log("4. 交易总结:");
    const isPumpFun = testData.meta.logMessages.some(log => 
        log.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
    );
    const isCreate = testData.meta.logMessages.some(log => 
        log.includes('Instruction: Create')
    );
    const hasTokenMint = testData.meta.postTokenBalances.length > 0;
    
    console.log(`  - 是否为 Pump Fun 交易: ${isPumpFun ? '是' : '否'}`);
    console.log(`  - 是否为创建指令: ${isCreate ? '是' : '否'}`);
    console.log(`  - 是否涉及代币铸造: ${hasTokenMint ? '是' : '否'}`);
    console.log(`  - 交易费用: ${testData.meta.fee / 1e9} SOL`);
    console.log(`  - 计算单元消耗: ${testData.meta.computeUnitsConsumed}`);
    
    // 如果是 Pump Fun 创建交易，提取创建的代币地址
    if (isPumpFun && isCreate && hasTokenMint) {
        const newTokenMint = testData.meta.postTokenBalances[0].mint;
        console.log(`  - 新创建的代币地址: ${newTokenMint}`);
    }
    
    console.log("\n=== 解析测试完成 ===");
    
    return {
        isPumpFun,
        isCreate,
        hasTokenMint,
        tokenMint: hasTokenMint ? testData.meta.postTokenBalances[0].mint : null,
        solChanges,
        fee: testData.meta.fee / 1e9
    };
};

// 如果作为模块运行，执行测试
if (import.meta.main) {
    await runParsingTest();
} 