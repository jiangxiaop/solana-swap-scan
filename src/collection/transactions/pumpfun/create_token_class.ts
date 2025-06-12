import {
    Connection,
    PublicKey,
    ParsedTransactionWithMeta,
    TokenBalance,
    ConfirmedTransactionMeta
} from '@solana/web3.js';
import { BN } from 'bn.js';
import * as bs58 from 'bs58';
import { Buffer } from "node:buffer";

// 关键程序ID常量
const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const ATOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// PumpFun指令类型枚举
enum PumpFunInstructionType {
    CREATE = 'Create',
    BUY = 'Buy',
    SELL = 'Sell',
    MIGRATE = 'Migrate',
    UNKNOWN = 'Unknown'
}

// 交易类型枚举
enum TransactionType {
    TOKEN_CREATION = 'TOKEN_CREATION',
    TOKEN_BUY = 'TOKEN_BUY',
    TOKEN_SELL = 'TOKEN_SELL',
    TOKEN_MIGRATE = 'TOKEN_MIGRATE',
    LIQUIDITY_ADD = 'LIQUIDITY_ADD',
    LIQUIDITY_REMOVE = 'LIQUIDITY_REMOVE',
    UNKNOWN = 'UNKNOWN'
}

// 代币信息接口
interface TokenInfo {
    mint: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    imageUrl?: string;
}

// 交易分析结果接口
interface TransactionAnalysis {
    type: TransactionType;
    signature: string;
    blockTime?: number;
    fee: number;
    successful: boolean;
    tokenInfo?: TokenInfo;
    creator?: string;
    solFlow?: SolFlow[];
    tokenFlow?: TokenFlow[];
    bondingCurveParams?: BondingCurveParams;
    computeUnits: number;
}

// SOL资金流动
interface SolFlow {
    from: string;
    to: string;
    amount: number;
    purpose?: string;
}

// 代币资金流动
interface TokenFlow {
    token: string;
    from: string;
    to: string;
    amount: string;
    decimals: number;
    uiAmount: number;
}

// 绑定曲线参数
interface BondingCurveParams {
    initialPrice?: number; // 初始价格（SOL）
    initialSupply?: string; // 初始供应量
    reserveAmount?: number; // 储备金（SOL）
    k?: number; // 曲线系数
    fee?: number; // 费率
}

/**
 * PumpFun交易解析器类
 */
export class PumpFunTransactionParser {


    /**
     * 解析交易并分析
     * @param transactionData 交易数据或签名
     */
    public parseTransaction(transactionData: any): TransactionAnalysis {
        const txData = transactionData;

        if (!txData) {
            throw new Error('无法获取交易数据');
        }

        // 初始化分析结果
        const analysis: TransactionAnalysis = {
            type: TransactionType.UNKNOWN,
            signature: this.extractSignature(txData),
            fee: this.extractFee(txData),
            successful: this.isSuccessful(txData),
            computeUnits: this.extractComputeUnits(txData),
            blockTime: txData.blockTime || undefined
        };

        // 根据交易内容分析交易类型和其他信息
        if (this.isPumpFunTransaction(txData)) {
            // 确定交易类型
            analysis.type = this.determineTransactionType(txData);

            // 解析代币信息（如果是代币创建交易）
            if (analysis.type === TransactionType.TOKEN_CREATION) {
                analysis.tokenInfo = this.extractTokenInfo(txData);
                analysis.creator = this.extractCreator(txData);
                analysis.bondingCurveParams = this.extractBondingCurveParams(txData);
            }

            // 解析SOL和代币流动情况
            analysis.solFlow = this.extractSolFlow(txData);
            analysis.tokenFlow = this.extractTokenFlow(txData);
        }

        return analysis;
    }

    /**
     * 判断交易是否是PumpFun相关交易
     */
    private isPumpFunTransaction(txData: any): boolean {
        // 检查交易中是否包含PumpFun程序
        const programIds = this.extractProgramIds(txData);
        return programIds.some(id => id === PUMP_FUN_PROGRAM_ID.toBase58());
    }

    /**
     * 确定交易类型
     */
    private determineTransactionType(txData: any): TransactionType {
        // 分析日志消息确定交易类型
        const logs = this.getLogMessages(txData);
        const hasCreate = logs.some(log => log.includes('Instruction: Create'));
        const hasBuy = logs.some(log => log.includes('Instruction: Buy'));
        const hasSell = logs.some(log => log.includes('Instruction: Sell'));
        const hasMigrate = logs.some(log => log.includes('Instruction: Migrate'));

        if (hasCreate) {
            return TransactionType.TOKEN_CREATION;
        } else if (hasBuy) {
            return TransactionType.TOKEN_BUY;
        } else if (hasSell) {
            return TransactionType.TOKEN_SELL;
        } else if (hasMigrate) {
            return TransactionType.TOKEN_MIGRATE;
        }

        return TransactionType.UNKNOWN;
    }

    /**
     * 提取代币信息
     */
    private extractTokenInfo(txData: any): TokenInfo | undefined {
        try {
            // 从元数据日志中提取代币信息
            const logs = this.getLogMessages(txData);

            // 找到包含元数据的日志
            const metadataLog = logs.find(log => log.includes('Program data:'));
            if (!metadataLog) return undefined;

            // 查找包含MintTo指令的日志，该日志的前面通常有代币Mint地址
            const mintLog = logs.find(log => log.includes('Instruction: MintTo'));
            const mintIndex = logs.indexOf(mintLog || '');
            let mintAddress = '';

            if (mintIndex > 0) {
                // 分析前面的日志找到mint地址
                for (let i = mintIndex - 1; i >= 0; i--) {
                    if (logs[i].includes('success') && i > 0 && logs[i - 2].includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke')) {
                        // 通常mint地址会在之前的账户中
                        const accountKeys = txData.transaction.message.accountKeys;
                        mintAddress = accountKeys[1].pubkey.toBase58();
                        break;
                    }
                }
            }

            // 如果上面的逻辑未找到mint地址，从post token balances中获取
            if (!mintAddress && txData.meta.postTokenBalances && txData.meta.postTokenBalances.length > 0) {
                mintAddress = txData.meta.postTokenBalances[0].mint;
            }

            // 从程序数据中解析代币名称和符号
            // 提取metadata部分（这部分代码需要根据实际数据格式调整）
            const dataLine = metadataLog.split('Program data: ')[1];

            // 这里需要专门解析元数据，以下是一个简化版本
            let nameMatch, symbolMatch, urlMatch;
            let name = '', symbol = '', imageUrl = '';

            // 通过解码base58编码的程序数据来提取元数据
            if (dataLine && dataLine.length > 20) {
                // 由于数据部分有特定格式，我们尝试通过正则或直接解析
                // 这里仅为示例，可能需要根据实际数据格式调整
                const plainTextPart = Buffer.from(dataLine, 'base64').toString('utf8');
                nameMatch = plainTextPart.match(/([a-zA-Z0-9]+)/);
                name = nameMatch ? nameMatch[1] : '';

                symbolMatch = plainTextPart.match(/([A-Z0-9]+)/);
                symbol = symbolMatch && symbolMatch[1] !== name ? symbolMatch[1] : '';

                urlMatch = plainTextPart.match(/(https?:\/\/[^\s]+)/);
                imageUrl = urlMatch ? urlMatch[1] : '';
            }

            // 提取代币精度
            const decimals = this.extractTokenDecimals(txData);

            // 计算总供应量
            const totalSupply = this.calculateTotalSupply(txData);


            return {
                mint: mintAddress,
                name: name || 'Unknown',
                symbol: symbol || 'UNKNOWN',
                decimals: decimals || 6,
                totalSupply: totalSupply || '0',
                imageUrl: imageUrl
            };
        } catch (e) {
            console.error('提取代币信息失败:', e);
            return undefined;
        }
    }

    /**
     * 提取代币精度
     */
    private extractTokenDecimals(txData: any): number {
        // 从postTokenBalances中推断精度
        if (txData.meta.postTokenBalances && txData.meta.postTokenBalances.length > 0) {
            return txData.meta.postTokenBalances[0].uiTokenAmount.decimals;
        }
        // 默认返回6（大多数代币精度）
        return 6;
    }

    /**
     * 计算代币总供应量
     */
    private calculateTotalSupply(txData: any): string {
        try {
            if (!txData.meta.postTokenBalances || txData.meta.postTokenBalances.length === 0) {
                return '0';
            }

            // 计算所有代币账户中的总和
            let totalSupply = new BN(0);
            for (const tokenBalance of txData.meta.postTokenBalances) {
                const amount = new BN(tokenBalance.uiTokenAmount.amount);
                totalSupply = totalSupply.add(amount);
            }

            return totalSupply.toString();
        } catch (e) {
            console.error('计算总供应量失败:', e);
            return '0';
        }
    }

    /**
     * 提取创建者地址
     */
    private extractCreator(txData: any): string | undefined {
        // 创建者通常是签名者
        if (txData.transaction.signatures && txData.transaction.signatures.length > 0) {
            const accountKeys = txData.transaction.message.accountKeys;
            return accountKeys[0].pubkey.toBase58();
        }
        return undefined;
    }

    /**
     * 提取绑定曲线参数
     */
    private extractBondingCurveParams(txData: any): BondingCurveParams | undefined {
        try {
            // 提取初始SOL金额（通常是创建者支付的费用）
            const preBalances = txData.meta.preBalances;
            const postBalances = txData.meta.postBalances;
            const fee = txData.meta.fee;

            // 计算创建者花费的SOL（排除交易费用）
            const creatorIndex = 0; // 通常创建者是第一个签名者
            const solSpent = (preBalances[creatorIndex] - postBalances[creatorIndex] - fee) / 1e9;

            // 从post token balances中获取初始分配情况
            const postTokenBalances = txData.meta.postTokenBalances || [];
            let initialSupply = '0';
            if (postTokenBalances.length > 0) {
                initialSupply = postTokenBalances.reduce((sum: BN, tb: TokenBalance) => {
                    return sum.add(new BN(tb.uiTokenAmount.amount));
                }, new BN(0)).toString();
            }

            // 由于绑定曲线的k值和其他参数不直接暴露在交易数据中
            // 我们可能需要进行反向计算或进一步分析
            return {
                initialPrice: solSpent / parseFloat(initialSupply) * 1e9, // 粗略估计初始价格
                initialSupply,
                reserveAmount: solSpent, // 储备金通常是创建者支付的SOL
                fee: 0.01 // 默认费率1%，这需要通过分析确认
            };
        } catch (e) {
            console.error('提取绑定曲线参数失败:', e);
            return undefined;
        }
    }

    /**
     * 提取SOL流动信息
     */
    private extractSolFlow(txData: any): SolFlow[] {
        const solFlows: SolFlow[] = [];
        const accountKeys = txData.transaction.message.accountKeys;
        const preBalances = txData.meta.preBalances;
        const postBalances = txData.meta.postBalances;

        // 分析余额变化
        for (let i = 0; i < accountKeys.length; i++) {
            const pre = preBalances[i] || 0;
            const post = postBalances[i] || 0;
            const diff = post - pre;

            if (diff !== 0) {
                // 确定资金流向
                if (diff > 0) {
                    // 收到SOL
                    solFlows.push({
                        from: 'unknown', // 需要从交易内部指令进一步分析
                        to: accountKeys[i].pubkey.toBase58(),
                        amount: diff / 1e9, // 转换为SOL单位
                        purpose: this.determineSolPurpose(txData, i, true)
                    });
                } else if (diff < 0) {
                    // 支出SOL
                    solFlows.push({
                        from: accountKeys[i].pubkey.toBase58(),
                        to: 'unknown', // 需要从交易内部指令进一步分析
                        amount: Math.abs(diff) / 1e9, // 转换为SOL单位
                        purpose: this.determineSolPurpose(txData, i, false)
                    });
                }
            }
        }

        // 进一步分析内部指令，确定精确的资金流向
        this.enhanceSolFlowWithInnerInstructions(txData, solFlows);

        return solFlows;
    }

    /**
     * 确定SOL流动用途
     */
    private determineSolPurpose(txData: any, accountIndex: number, isReceiving: boolean): string {
        // 通过交易类型和账户角色确定用途
        const txType = this.determineTransactionType(txData);
        const accountKeys = txData.transaction.message.accountKeys;
        const accountPubkey = accountKeys[accountIndex].pubkey.toBase58();

        // 特殊账户识别
        if (accountPubkey === SYSTEM_PROGRAM_ID.toBase58()) {
            return 'system_program';
        } else if (accountPubkey === PUMP_FUN_PROGRAM_ID.toBase58()) {
            return 'pump_fun_program';
        }

        // 通过交易类型判断
        if (txType === TransactionType.TOKEN_CREATION) {
            if (!isReceiving) {
                return 'token_creation_fee';
            } else {
                return 'rent_exempt';
            }
        } else if (txType === TransactionType.TOKEN_BUY) {
            if (!isReceiving) {
                return 'token_purchase';
            } else {
                return 'liquidity_provider';
            }
        }

        return 'unknown';
    }

    /**
     * 使用内部指令增强SOL流动分析
     */
    private enhanceSolFlowWithInnerInstructions(txData: any, solFlows: SolFlow[]): void {
        // 这需要分析内部指令的资金流向，过于复杂，简化处理
        // 实际实现需要详细分析内部指令
    }

    /**
     * 提取代币流动信息
     */
    private extractTokenFlow(txData: any): TokenFlow[] {
        const tokenFlows: TokenFlow[] = [];

        // 如果没有代币余额信息，直接返回空数组
        if (!txData.meta.postTokenBalances || txData.meta.postTokenBalances.length === 0) {
            return tokenFlows;
        }

        // 获取代币余额变化
        const preTokenBalances = txData.meta.preTokenBalances || [];
        const postTokenBalances = txData.meta.postTokenBalances || [];
        const accountKeys = txData.transaction.message.accountKeys;

        // 处理创建后的初始分配
        if (preTokenBalances.length === 0 && postTokenBalances.length > 0) {
            // 新代币创建情况
            for (const post of postTokenBalances) {
                const accountIndex = post.accountIndex;
                const owner = post.owner;
                const mint = post.mint;
                const amount = post.uiTokenAmount.amount;
                const decimals = post.uiTokenAmount.decimals;
                const uiAmount = post.uiTokenAmount.uiAmount || 0;

                tokenFlows.push({
                    token: mint,
                    from: 'mint', // 新创建的代币来自铸币
                    to: owner,
                    amount,
                    decimals,
                    uiAmount
                });
            }
            return tokenFlows;
        }

        // 处理现有代币的转账
        // 这里需要匹配pre和post来确定变化
        // 实际实现会更复杂，需要考虑多种情况

        return tokenFlows;
    }

    /**
     * 从交易数据中提取签名
     */
    private extractSignature(txData: any): string {
        if (txData.transaction && txData.transaction.signatures && txData.transaction.signatures.length > 0) {
            return txData.transaction.signatures[0];
        }
        return 'unknown';
    }

    /**
     * 提取交易费用
     */
    private extractFee(txData: any): number {
        if (txData.meta && txData.meta.fee) {
            return txData.meta.fee / 1e9; // 转换为SOL
        }
        return 0;
    }

    /**
     * 检查交易是否成功
     */
    private isSuccessful(txData: any): boolean {
        return txData.meta && txData.meta.err === null;
    }

    /**
     * 提取消耗的计算单元
     */
    private extractComputeUnits(txData: any): number {
        if (txData.meta && txData.meta.computeUnitsConsumed) {
            return txData.meta.computeUnitsConsumed;
        }
        return 0;
    }

    /**
     * 提取交易中涉及的程序ID列表
     */
    private extractProgramIds(txData: any): string[] {
        const programIds: string[] = [];
        const logs = this.getLogMessages(txData);

        // 从日志中提取程序ID
        for (const log of logs) {
            const match = log.match(/Program ([1-9A-HJ-NP-Za-km-z]{43,44}) invoke/);
            if (match && match[1]) {
                const programId = match[1];
                if (!programIds.includes(programId)) {
                    programIds.push(programId);
                }
            }
        }

        return programIds;
    }

    /**
     * 获取交易日志消息
     */
    private getLogMessages(txData: any): string[] {
        if (txData.meta && txData.meta.logMessages) {
            return txData.meta.logMessages;
        }
        return [];
    }

    /**
     * 解析程序数据
     */
    private parseProgramData(base64Data: string): any {
        try {
            // 解码base64数据
            const buffer = Buffer.from(base64Data, 'base64');
            // 实际解析逻辑需要根据PumpFun程序的数据格式实现
            // 这里只是占位
            return {};
        } catch (e) {
            console.error('解析程序数据失败:', e);
            return {};
        }
    }
}

// 使用示例
async function analyzePumpFunTransaction() {
    // 初始化解析器
    const parser = new PumpFunTransactionParser();

    // 分析示例交易（传入交易数据或签名）
    const txSignature = 'a9tyifZay3w5j6yL7egpNxxBsQFTuvQHKf3XHjnLY2QToVDjnyT5gPLjbJ2qSXmVPGJzEpEZmgJZ6qQXS99p1JH';
    // 或者传入您提供的完整交易数据
    // const txData = {...}; // 您提供的交易数据

    try {
        const analysis = await parser.parseTransaction(txSignature);
        console.log('交易分析结果:');
        console.log(JSON.stringify(analysis, null, 2));
    } catch (e) {
        console.error('分析交易失败:', e);
    }
}

// 如果直接运行此脚本，则执行分析
if (require.main === module) {
    analyzePumpFunTransaction().catch(console.error);
}