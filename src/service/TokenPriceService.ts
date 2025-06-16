import redisClient from "../../config/redis.ts";

const BASE_URL = "https://api.binance.com/api/v3/ticker/price";
const TTL_SECONDS = 3;

export class TokenPriceService {
    /**
     * 获取某个 token 对（如 SOL/USDT）的价格，并缓存 3 秒
     * @param baseToken 如 "SOL"
     * @param quoteToken 如 "USDT"
     * @returns 实时价格
     */
    public static async getPrice(baseToken: string, quoteToken: string): Promise<number> {
        if (baseToken==='USDC' || baseToken==='USDT') return 1;
        if (baseToken==='WSOL'){
            baseToken = 'SOL';
        }
        const symbol = `${baseToken.toUpperCase()}${quoteToken.toUpperCase()}`;
        const cacheKey = `price:${symbol}`;

        // 尝试从 Redis 缓存获取
        const cached = await redisClient.get(cacheKey);
        if (cached) return parseFloat(cached);

        // 请求 Binance API
        const encodedSymbols = encodeURIComponent(JSON.stringify([symbol]));
        const url = `${BASE_URL}?symbols=${encodedSymbols}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Binance API error (${response.status}): ${await response.text()}`);
        }

        const data = await response.json();
        const priceStr = data?.[0]?.price;

        if (!priceStr) {
            throw new Error(`Invalid response for ${symbol}: ${JSON.stringify(data)}`);
        }

        const price = parseFloat(priceStr);

        // 缓存 3 秒
        await redisClient.set(cacheKey, priceStr, { ex: TTL_SECONDS });

        return price;
    }
}