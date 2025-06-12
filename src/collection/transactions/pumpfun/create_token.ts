import { Buffer } from "node:buffer";
import { TokenInfo } from "../../../type/token.ts";
import { SolanaOnChainDataStruct } from "../../../type/transaction.ts";

interface CreateTokenTransaction {
    signature: string;
    blockTime: number;
    slot: number;
    userAddress: string;
    protocol: string;
    tokenAddress: string;
    creatorAddress: string;
    creatorTokenAmount: number;
    token: TokenInfo
}

// export const parsePumpfunCreateTokenTransaction = (transaction: SolanaOnChainDataStruct): CreateTokenTransaction => {
//     const { meta, transaction: { message, signatures, version } } = transaction;
// }

export const extractTokenInfo = (transaction: SolanaOnChainDataStruct): TokenInfo => {
    const { meta, transaction: { message } } = transaction;

    const tokenInfo: TokenInfo = {
        address: '',
        name: '',
        symbol: '',
        decimals: 0,
        imageUrl: '',
        totalSupply: 0,
        circulatingSupply: 0,
    }

    const mintLog = meta.logMessages.find(log => log.includes('Instruction: MintTo'));
    const mintIndex = meta.logMessages.indexOf(mintLog || '');
    let mintAddress = '';

    if (mintIndex > 0) {
        const accountKeys = message.accountKeys;
        mintAddress = accountKeys[1];
    }

    if (!mintAddress && meta.postTokenBalances && meta.postTokenBalances.length > 0) {
        mintAddress = meta.postTokenBalances[0].mint;
    }

    const metadataLog = meta.logMessages.find(log => log.includes('Program data:'));
    if (!metadataLog) return tokenInfo;

    const dataLine = metadataLog.split('Program data: ')[1];
    let plainTextPart = '';
    if (dataLine && dataLine.length > 20) {
        plainTextPart = Buffer.from(dataLine, 'base64').toString('utf8');

        console.log(plainTextPart);
        

        const nameMatch = plainTextPart.match(/([a-zA-Z0-9]+)/);
        console.log(nameMatch);
        tokenInfo.name = nameMatch ? nameMatch[1] : '';
    }

    const symbolMatch = plainTextPart.match(/([A-Z0-9]+)/);
    tokenInfo.symbol = symbolMatch ? symbolMatch[1] : '';

    const decimalsMatch = plainTextPart.match(/([0-9]+)/);
    tokenInfo.decimals = decimalsMatch ? parseInt(decimalsMatch[1]) : 0;

    const imageUrlMatch = plainTextPart.match(/(https?:\/\/[^\s]+)/);
    tokenInfo.imageUrl = imageUrlMatch ? imageUrlMatch[1] : '';

    const totalSupplyMatch = plainTextPart.match(/([0-9]+)/);
    tokenInfo.totalSupply = totalSupplyMatch ? parseInt(totalSupplyMatch[1]) : 0;
    tokenInfo.circulatingSupply = tokenInfo.totalSupply - tokenInfo.totalSupply;
    tokenInfo.address = mintAddress;

    return tokenInfo;
}