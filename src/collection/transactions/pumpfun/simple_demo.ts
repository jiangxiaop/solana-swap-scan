import { Buffer } from "node:buffer";

const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// 测试数据 - 从你的 a.json 中提取的关键部分
const testTransactionData = {
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
        "computeUnitsConsumed": 197037
    },
    "transaction": {
        "signatures": [
            "a9tyifZay3w5j6yL7egpNxxBsQFTuvQHKf3XHjnLY2QToVDjnyT5gPLjbJ2qSXmVPGJzEpEZmgJZ6qQXS99p1JH"
        ]
    }
};

// 解析 Program data 中的代币元数据
function parseTokenMetadata(base64Data: string) {
    console.log("=== 解析代币元数据 ===");
    console.log(`Base64 数据: ${base64Data.substring(0, 50)}...`);
    
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`缓冲区长度: ${buffer.length} 字节`);
        
        // 解码为 UTF-8 文本
        const utf8Text = buffer.toString('utf8');
        console.log("UTF-8 文本 (前100字符):", utf8Text.substring(0, 100));
        
        // 提取可读字符
        const readable = utf8Text.replace(/[^\x20-\x7E]/g, '');
        console.log("可读部分:", readable);
        
        // 使用正则表达式提取信息
        const results: any = {
            rawText: readable,
            extracted: {}
        };
        
        // 查找 HTTPS URL (图片链接)
        const urlMatch = readable.match(/(https?:\/\/[^\s\x00-\x1F]+)/);
        if (urlMatch) {
            results.extracted.imageUrl = urlMatch[1];
            console.log("✅ 找到图片URL:", urlMatch[1]);
        }
        
        // 查找可能的代币名称和符号
        const words = readable.match(/[a-zA-Z]{2,}/g) || [];
        console.log("找到的单词:", words);
        
        if (words.length > 0) {
            // 第一个较长的单词可能是名称
            const nameCandidate = words.find(w => w.length > 3 && w.length < 20);
            if (nameCandidate) {
                results.extracted.name = nameCandidate;
                console.log("✅ 推测代币名称:", nameCandidate);
            }
            
            // 查找可能的符号（通常是大写字母）
            const symbolCandidate = words.find(w => w.length >= 2 && w.length <= 10 && w === w.toUpperCase());
            if (symbolCandidate) {
                results.extracted.symbol = symbolCandidate;
                console.log("✅ 推测代币符号:", symbolCandidate);
            }
        }
        
        return results;
        
    } catch (error) {
        console.error("❌ 解析失败:", error);
        return null;
    }
}

// 分析交易类型和结果
function analyzeTransaction(transactionData: any) {
    console.log("\n=== 交易分析 ===");
    
    const { meta } = transactionData;
    
    // 检查是否是 Pump Fun 交易
    const isPumpFun = meta.logMessages.some((log: string) => 
        log.includes(PUMP_FUN_PROGRAM_ID)
    );
    console.log("是 Pump Fun 交易:", isPumpFun ? "✅ 是" : "❌ 否");
    
    // 检查指令类型
    const isCreate = meta.logMessages.some((log: string) => 
        log.includes("Instruction: Create")
    );
    const isBuy = meta.logMessages.some((log: string) => 
        log.includes("Instruction: Buy")
    );
    const isSell = meta.logMessages.some((log: string) => 
        log.includes("Instruction: Sell")
    );
    
    console.log("指令类型:");
    console.log("  - 创建:", isCreate ? "✅" : "❌");
    console.log("  - 购买:", isBuy ? "✅" : "❌");
    console.log("  - 出售:", isSell ? "✅" : "❌");
    
    // 分析代币信息
    if (meta.postTokenBalances && meta.postTokenBalances.length > 0) {
        console.log("\n💰 代币余额信息:");
        meta.postTokenBalances.forEach((balance: any, index: number) => {
            console.log(`  代币 ${index + 1}:`);
            console.log(`    🏷️  地址: ${balance.mint}`);
            console.log(`    📊 数量: ${balance.uiTokenAmount.uiAmountString}`);
            console.log(`    🔢 小数位: ${balance.uiTokenAmount.decimals}`);
        });
    }
    
    // 交易费用和性能
    console.log("\n💸 交易费用和性能:");
    console.log(`  💰 费用: ${(meta.fee / 1e9).toFixed(6)} SOL`);
    console.log(`  ⚡ 计算单元: ${meta.computeUnitsConsumed.toLocaleString()}`);
    
    return {
        isPumpFun,
        isCreate,
        isBuy,
        isSell,
        tokenInfo: meta.postTokenBalances?.[0] || null
    };
}

// 创建完整的代币信息对象
function createTokenInfo(metadata: any, tokenBalance: any) {
    return {
        address: tokenBalance?.mint || "未知",
        name: metadata?.extracted?.name || "未知",
        symbol: metadata?.extracted?.symbol || "未知",
        decimals: tokenBalance?.uiTokenAmount?.decimals || 0,
        totalSupply: tokenBalance?.uiTokenAmount?.uiAmountString || "0",
        imageUrl: metadata?.extracted?.imageUrl || "未找到",
        // 从原始数据中提取的额外信息
        rawMetadata: metadata?.rawText || "",
        // Pump Fun 特有信息
        platform: "Pump Fun",
        bondingCurveComplete: false // 从其他字段可以推断
    };
}

// 主演示函数
async function demonstratePumpFunParser() {
    console.log("🚀 Pump Fun 交易解析演示");
    console.log("=".repeat(60));
    
    // 1. 分析交易基本信息
    console.log("📋 第一步: 分析交易基本信息");
    const analysis = analyzeTransaction(testTransactionData);
    
    // 2. 解析代币元数据
    console.log("\n📊 第二步: 解析代币元数据");
    const metadataLog = testTransactionData.meta.logMessages.find(log => 
        log.includes('Program data:')
    );
    
    let tokenMetadata = null;
    if (metadataLog) {
        const base64Data = metadataLog.split('Program data: ')[1];
        tokenMetadata = parseTokenMetadata(base64Data);
    } else {
        console.log("❌ 未找到代币元数据日志");
    }
    
    // 3. 合并信息，创建完整的代币信息
    if (tokenMetadata && analysis.tokenInfo) {
        console.log("\n🎯 第三步: 创建完整的代币信息");
        const completeTokenInfo = createTokenInfo(tokenMetadata, analysis.tokenInfo);
        
        console.log("=== 完整代币信息 ===");
        console.log("🏷️  代币地址:", completeTokenInfo.address);
        console.log("📛 代币名称:", completeTokenInfo.name);
        console.log("🔤 代币符号:", completeTokenInfo.symbol);
        console.log("🔢 小数位数:", completeTokenInfo.decimals);
        console.log("📊 总供应量:", completeTokenInfo.totalSupply);
        console.log("🖼️  图片链接:", completeTokenInfo.imageUrl);
        console.log("🏛️  发行平台:", completeTokenInfo.platform);
        
        // 4. 生成可用于数据库的结构
        console.log("\n💾 数据库存储格式:");
        console.log(JSON.stringify(completeTokenInfo, null, 2));
    }
    
    // 5. 使用指南
    console.log("\n📖 使用指南");
    console.log("=".repeat(30));
    console.log("1. 要解析任何 Pump Fun 交易，只需要交易的日志数据");
    console.log("2. 查找包含 'Program data:' 的日志行");
    console.log("3. 提取 base64 数据并解码");
    console.log("4. 使用正则表达式提取代币名称、符号和图片链接");
    console.log("5. 结合 postTokenBalances 获取代币地址和供应量信息");
    
    console.log("\n🎉 解析完成！你现在可以:");
    console.log("   - 将解析函数集成到你的应用中");
    console.log("   - 批量处理 Pump Fun 交易");
    console.log("   - 存储代币信息到数据库");
    console.log("   - 构建代币跟踪系统");
    
    return {
        analysis,
        tokenMetadata,
        completeTokenInfo: tokenMetadata && analysis.tokenInfo ? 
            createTokenInfo(tokenMetadata, analysis.tokenInfo) : null
    };
}

// 导出可以在其他地方使用的函数
export { 
    parseTokenMetadata, 
    analyzeTransaction, 
    createTokenInfo,
    demonstratePumpFunParser 
};

// 如果直接运行此文件，执行演示
if (import.meta.main) {
    await demonstratePumpFunParser();
} 