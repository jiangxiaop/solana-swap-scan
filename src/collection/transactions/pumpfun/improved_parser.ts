import { Buffer } from "node:buffer";

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    imageUrl: string;
    platform: string;
    rawMetadata: string;
    bondingCurveComplete: boolean;
}

// 改进的代币元数据解析器
function parseTokenMetadataImproved(base64Data: string) {
    console.log("=== 改进的代币元数据解析 ===");
    
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const utf8Text = buffer.toString('utf8');
        
        // 提取可读字符
        const readable = utf8Text.replace(/[^\x20-\x7E]/g, '');
        console.log("可读部分:", readable);
        
        const results: any = {
            rawText: readable,
            extracted: {}
        };
        
        // 1. 查找 HTTPS URL (图片链接) - 改进的正则表达式
        const urlMatch = readable.match(/(https?:\/\/[^\s\x00-\x1F:]+)/);
        if (urlMatch) {
            results.extracted.imageUrl = urlMatch[1];
            console.log("✅ 图片URL:", urlMatch[1]);
        }
        
        // 2. 改进的名称和符号提取逻辑
        // 查找可能的代币名称模式：连续的字母，长度在3-20之间
        const tokenPatterns = readable.match(/[a-zA-Z]{3,20}/g) || [];
        console.log("可能的代币模式:", tokenPatterns);
        
        // 3. 特殊处理 - 查找常见的代币命名模式
        // 先查找可能的名称（通常是小写或首字母大写）
        const nameCandidate = tokenPatterns.find(word => {
            // 排除常见的非代币单词
            const excludeWords = ['https', 'ipfs', 'com', 'org', 'www'];
            const lowerWord = word.toLowerCase();
            
            return !excludeWords.includes(lowerWord) && 
                   word.length >= 3 && 
                   word.length <= 15 &&
                   // 查找小写字母开头或首字母大写的单词
                   (/^[a-z]+$/.test(word) || /^[A-Z][a-z]+$/.test(word));
        });
        
        // 查找可能的符号（通常是全大写，2-10字符）
        const symbolCandidate = tokenPatterns.find(word => {
            return /^[A-Z]{2,10}$/.test(word) && 
                   word !== 'HTTPS' && 
                   word !== 'IPFS' &&
                   word.length >= 2 && 
                   word.length <= 10;
        });
        
        if (nameCandidate) {
            results.extracted.name = nameCandidate;
            console.log("✅ 推测代币名称:", nameCandidate);
        }
        
        if (symbolCandidate) {
            results.extracted.symbol = symbolCandidate;
            console.log("✅ 推测代币符号:", symbolCandidate);
        }
        
        // 4. 如果没有找到标准模式，尝试其他方法
        if (!results.extracted.name || !results.extracted.symbol) {
            console.log("🔍 尝试替代解析方法...");
            
            // 查找重复出现的单词模式（大小写变体）
            const wordFreq: {[key: string]: string[]} = {};
            tokenPatterns.forEach(word => {
                const lowerWord = word.toLowerCase();
                if (!wordFreq[lowerWord]) {
                    wordFreq[lowerWord] = [];
                }
                wordFreq[lowerWord].push(word);
            });
            
            // 查找出现多次的单词（可能是名称和符号的不同大小写形式）
            for (const [lowerWord, variants] of Object.entries(wordFreq)) {
                if (variants.length > 1 && lowerWord.length >= 3 && lowerWord.length <= 15) {
                    const hasLowercase = variants.some(v => /^[a-z]+$/.test(v));
                    const hasUppercase = variants.some(v => /^[A-Z]+$/.test(v));
                    
                    if (hasLowercase && hasUppercase) {
                        if (!results.extracted.name) {
                            results.extracted.name = variants.find(v => /^[a-z]+$/.test(v)) || variants[0];
                            console.log("✅ 通过模式匹配找到名称:", results.extracted.name);
                        }
                        if (!results.extracted.symbol) {
                            results.extracted.symbol = variants.find(v => /^[A-Z]+$/.test(v)) || variants[0];
                            console.log("✅ 通过模式匹配找到符号:", results.extracted.symbol);
                        }
                    }
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.error("❌ 解析失败:", error);
        return null;
    }
}

// 从完整的交易数据创建代币信息
function createCompleteTokenInfo(transactionData: any): TokenInfo | null {
    const { meta } = transactionData;
    
    // 1. 查找代币余额信息
    const tokenBalance = meta.postTokenBalances?.[0];
    if (!tokenBalance) {
        console.log("❌ 未找到代币余额信息");
        return null;
    }
    
    // 2. 解析元数据
    const metadataLog = meta.logMessages.find((log: string) => 
        log.includes('Program data:')
    );
    
    let tokenMetadata = null;
    if (metadataLog) {
        const base64Data = metadataLog.split('Program data: ')[1];
        tokenMetadata = parseTokenMetadataImproved(base64Data);
    }
    
    // 3. 创建完整的代币信息对象
    const tokenInfo: TokenInfo = {
        address: tokenBalance.mint,
        name: tokenMetadata?.extracted?.name || "Unknown",
        symbol: tokenMetadata?.extracted?.symbol || "UNK",
        decimals: tokenBalance.uiTokenAmount.decimals,
        totalSupply: tokenBalance.uiTokenAmount.uiAmountString,
        imageUrl: tokenMetadata?.extracted?.imageUrl || "",
        platform: "Pump Fun",
        rawMetadata: tokenMetadata?.rawText || "",
        bondingCurveComplete: false
    };
    
    return tokenInfo;
}

// 分析交易并返回结构化信息
function analyzePumpFunTransaction(transactionData: any) {
    const { meta, transaction } = transactionData;
    
    const analysis = {
        isPumpFun: meta.logMessages.some((log: string) => 
            log.includes(PUMP_FUN_PROGRAM_ID)
        ),
        instructionType: {
            create: meta.logMessages.some((log: string) => 
                log.includes("Instruction: Create")
            ),
            buy: meta.logMessages.some((log: string) => 
                log.includes("Instruction: Buy")
            ),
            sell: meta.logMessages.some((log: string) => 
                log.includes("Instruction: Sell")
            )
        },
        transactionInfo: {
            signature: transaction.signatures?.[0] || "",
            fee: meta.fee / 1e9,
            computeUnits: meta.computeUnitsConsumed,
            success: !meta.err
        },
        tokenInfo: null as TokenInfo | null
    };
    
    // 如果是创建交易，提取代币信息
    if (analysis.isPumpFun && analysis.instructionType.create) {
        analysis.tokenInfo = createCompleteTokenInfo(transactionData);
    }
    
    return analysis;
}

// 批量处理函数（用于处理多个交易）
function batchProcessPumpFunTransactions(transactions: any[]): TokenInfo[] {
    const results: TokenInfo[] = [];
    
    console.log(`🔄 开始批量处理 ${transactions.length} 个交易...`);
    
    transactions.forEach((tx, index) => {
        try {
            const analysis = analyzePumpFunTransaction(tx);
            
            if (analysis.isPumpFun && analysis.tokenInfo) {
                results.push(analysis.tokenInfo);
                console.log(`✅ 交易 ${index + 1}: 成功解析代币 ${analysis.tokenInfo.symbol}`);
            } else {
                console.log(`⏭️  交易 ${index + 1}: 不是 Pump Fun 创建交易，跳过`);
            }
        } catch (error) {
            console.log(`❌ 交易 ${index + 1}: 解析失败 -`, error);
        }
    });
    
    console.log(`✅ 批量处理完成，共解析出 ${results.length} 个代币`);
    return results;
}

// 主演示函数 - 使用改进的解析器
async function demonstrateImprovedParser() {
    console.log("🚀 改进版 Pump Fun 交易解析器演示");
    console.log("=".repeat(60));
    
    // 测试数据
    const testData = {
        "meta": {
            "logMessages": [
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
                    "uiTokenAmount": {
                        "amount": "873764705882353",
                        "decimals": 6,
                        "uiAmount": 873764705.882353,
                        "uiAmountString": "873764705.882353"
                    }
                }
            ],
            "fee": 919000,
            "computeUnitsConsumed": 197037,
            "err": null
        },
        "transaction": {
            "signatures": [
                "a9tyifZay3w5j6yL7egpNxxBsQFTuvQHKf3XHjnLY2QToVDjnyT5gPLjbJ2qSXmVPGJzEpEZmgJZ6qQXS99p1JH"
            ]
        }
    };
    
    // 使用改进的解析器分析交易
    const analysis = analyzePumpFunTransaction(testData);
    
    console.log("📊 交易分析结果:");
    console.log("  - 是否为 Pump Fun 交易:", analysis.isPumpFun ? "✅ 是" : "❌ 否");
    console.log("  - 指令类型:", Object.entries(analysis.instructionType)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(", ") || "未知");
    console.log("  - 交易费用:", `${analysis.transactionInfo.fee.toFixed(6)} SOL`);
    console.log("  - 计算单元:", analysis.transactionInfo.computeUnits.toLocaleString());
    
    if (analysis.tokenInfo) {
        console.log("\n🎯 提取的代币信息:");
        console.log(`  📛 名称: ${analysis.tokenInfo.name}`);
        console.log(`  🔤 符号: ${analysis.tokenInfo.symbol}`);
        console.log(`  🏷️  地址: ${analysis.tokenInfo.address}`);
        console.log(`  🔢 小数位: ${analysis.tokenInfo.decimals}`);
        console.log(`  📊 总供应量: ${analysis.tokenInfo.totalSupply}`);
        console.log(`  🖼️  图片: ${analysis.tokenInfo.imageUrl}`);
        
        console.log("\n💾 JSON 格式:");
        console.log(JSON.stringify(analysis.tokenInfo, null, 2));
    }
    
    return analysis;
}

// 导出所有有用的函数
export {
    parseTokenMetadataImproved,
    createCompleteTokenInfo,
    analyzePumpFunTransaction,
    batchProcessPumpFunTransactions,
    demonstrateImprovedParser,
    type TokenInfo
};

// 如果直接运行此文件，执行演示
if (import.meta.main) {
    await demonstrateImprovedParser();
} 