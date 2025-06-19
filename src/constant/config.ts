import { Protocol } from "../type/enum.ts"

export const SOLANA_RPC_URL = "https://solana-mainnet.core.chainstack.com/18462a49342e3ef0f64835c002a078a5"

export const SOLANA_RPC_URL_WS = ""

export const SOLANA_DEX_OFFICIAL_ADDRESS = {

    [Protocol.JUPITER]: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    [Protocol.ORCA]: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
    [Protocol.PUMP_FUN]: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    [Protocol.METEORA]: "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"

}

export const SOLANA_DEX_ADDRESS_TO_NAME: Record<string, string> = {
    "11111111111111111111111111111111": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
    "So11111111111111111111111111111111111111112": "WSOL"
};


export const SOLANA_DEX_STABLE_TOKEN = [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", //USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" //usdt
]


export const SOLANA_DEX_BASE_TOKEN = [
    "11111111111111111111111111111111", // sol
    "So11111111111111111111111111111111111111112",// "WSOL"
    ...SOLANA_DEX_STABLE_TOKEN
]

export const PUMPFUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"


export const SNAP_SHOT_CONFIG = {
    MIN_TRANSACTION_AMOUNT: 0.0001, // 0.0001 SOL
    SNAPSHOT_TIME_WINDOW: 30, // 30秒 (改为秒级)
    BLOCKS_PER_SNAPSHOT: 10 // 每10个区块进行一次快照
};