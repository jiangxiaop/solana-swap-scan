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

// 最终版本的代币元数据解析器
function parseTokenMetadataFinal(base64Data: string) {
    console.log("=== 最终版代币元数据解析 ===");
    
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const utf8Text = buffer.toString('utf8');
        
        // 提取可读字符
        const readable = utf8Text.replace(/[^\x20-\x7E]/g, '');
        console.log("原始可读部分:", readable);
        
        const results: any = {
            rawText: readable,
            extracted: {}
        };
        
        // 1. 查找 HTTPS URL (图片链接)
        const urlMatch = readable.match(/(https?:\/\/[^\s\x00-\x1F:]+)/);
        if (urlMatch) {
            results.extracted.imageUrl = urlMatch[1];
            console.log("✅ 图片URL:", urlMatch[1]);
        }
        
        // 2. 智能解析代币名称和符号
        // 第一步：尝试识别连在一起的小写+大写模式（如 costcoCOSTCO）
        const combinedPattern = readable.match(/([a-z]{3,15})([A-Z]{2,10})/g);
        
        if (combinedPattern) {
            console.log("🔍 找到连接模式:", combinedPattern);
            
            for (const pattern of combinedPattern) {
                const match = pattern.match(/^([a-z]{3,15})([A-Z]{2,10})$/);
                if (match) {
                    const [, lowerPart, upperPart] = match;
                    
                    // 排除常见的非代币单词
                    const excludeWords = ['https', 'http', 'ipfs', 'com', 'org', 'www'];
                    if (!excludeWords.includes(lowerPart.toLowerCase())) {
                        results.extracted.name = lowerPart;
                        results.extracted.symbol = upperPart;
                        console.log("✅ 通过连接模式找到:");
                        console.log("   名称:", lowerPart);
                        console.log("   符号:", upperPart);
                        break;
                    }
                }
            }
        }
        
        // 3. 如果第一种方法没有找到，尝试其他方法
        if (!results.extracted.name || !results.extracted.symbol) {
            console.log("🔍 尝试其他解析方法...");
            
            // 查找所有可能的单词
            const allWords = readable.match(/[a-zA-Z]{2,20}/g) || [];
            console.log("所有单词:", allWords);
            
            // 按照长度和模式分类
            const lowercaseWords = allWords.filter(word => 
                /^[a-z]{3,15}$/.test(word) && 
                !['https', 'http', 'ipfs', 'com', 'org', 'www'].includes(word)
            );
            
            const uppercaseWords = allWords.filter(word => 
                /^[A-Z]{2,10}$/.test(word) && 
                !['HTTPS', 'HTTP', 'IPFS', 'COM', 'ORG', 'WWW'].includes(word)
            );
            
            console.log("小写候选:", lowercaseWords);
            console.log("大写候选:", uppercaseWords);
            
            // 如果还没找到名称，使用第一个合适的小写单词
            if (!results.extracted.name && lowercaseWords.length > 0) {
                results.extracted.name = lowercaseWords[0];
                console.log("✅ 备用方法找到名称:", lowercaseWords[0]);
            }
            
            // 如果还没找到符号，使用第一个合适的大写单词
            if (!results.extracted.symbol && uppercaseWords.length > 0) {
                results.extracted.symbol = uppercaseWords[0];
                console.log("✅ 备用方法找到符号:", uppercaseWords[0]);
            }
        }
        
        // 4. 如果仍然没有找到，进行最后的尝试
        if (!results.extracted.name || !results.extracted.symbol) {
            console.log("🔍 进行最后的尝试解析...");
            
            // 手动查找可能的模式
            // 查找 "word1word2WORD2" 这样的模式
            const manualPattern = readable.match(/([a-z]{3,10})([a-z]{3,10})([A-Z]{2,10})/);
            if (manualPattern) {
                const [, part1, part2, upperPart] = manualPattern;
                const possibleName = part1 === part2 ? part1 : part1 + part2;
                
                if (!results.extracted.name) {
                    results.extracted.name = possibleName;
                    console.log("✅ 手动模式找到名称:", possibleName);
                }
                
                if (!results.extracted.symbol) {
                    results.extracted.symbol = upperPart;
                    console.log("✅ 手动模式找到符号:", upperPart);
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
function createFinalTokenInfo(transactionData: any): TokenInfo | null {
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
        tokenMetadata = parseTokenMetadataFinal(base64Data);
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

// 完整的使用示例
async function demonstrateFinalParser() {
    console.log("🎯 最终版 Pump Fun 交易解析器");
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
    
    // 解析代币信息
    const tokenInfo = createFinalTokenInfo(testData);
    
    if (tokenInfo) {
        console.log("\n🎉 成功解析的代币信息:");
        console.log("=".repeat(40));
        console.log(`📛 代币名称: ${tokenInfo.name}`);
        console.log(`🔤 代币符号: ${tokenInfo.symbol}`);
        console.log(`🏷️  代币地址: ${tokenInfo.address}`);
        console.log(`🔢 小数位数: ${tokenInfo.decimals}`);
        console.log(`📊 总供应量: ${tokenInfo.totalSupply}`);
        console.log(`🖼️  图片链接: ${tokenInfo.imageUrl}`);
        console.log(`🏛️  发行平台: ${tokenInfo.platform}`);
        
        console.log("\n💾 完整的 JSON 数据结构:");
        console.log(JSON.stringify(tokenInfo, null, 2));
        
        console.log("\n📝 集成指南:");
        console.log("=".repeat(30));
        console.log("1. 将此解析器集成到你的应用中");
        console.log("2. 监听 Pump Fun 程序的交易");
        console.log("3. 过滤创建指令 (Instruction: Create)");
        console.log("4. 使用 createFinalTokenInfo() 解析代币信息");
        console.log("5. 存储到数据库或进行进一步处理");
        
        console.log("\n🔧 可能的改进:");
        console.log("- 添加错误处理和重试机制");
        console.log("- 支持批量处理多个交易");
        console.log("- 添加代币价格和市值信息");
        console.log("- 集成到实时监控系统");
    } else {
        console.log("❌ 解析失败");
    }
    
    return tokenInfo;
}

// 导出函数
export {
    parseTokenMetadataFinal,
    createFinalTokenInfo,
    demonstrateFinalParser,
    type TokenInfo
};

// 如果直接运行此文件，执行演示
if (import.meta.main) {
    await demonstrateFinalParser();
} 