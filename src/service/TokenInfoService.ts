import redisClient from "../../config/redis.ts";
import { fetchTokenMetadataService } from "./FetchTokenMetadataService.ts";
import { commonQuery } from "../utils/mysqlHelper.ts";

const tokenInfoCache = "token_info_cache";

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  uri: string;
  image: string;
}

/**
 * 主方法：先从 Redis 查找 token 信息，查不到则查数据库，查不到则 fetch 并写入
 */
export async function getTokenInfoUseCache(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  try {
    const tokenIncaseAddress = tokenAddress.toLowerCase();
    const cacheData = await redisClient.hget(
      tokenInfoCache,
      tokenIncaseAddress,
    );
    if (cacheData) {
      return JSON.parse(cacheData) as TokenInfo;
    }

    const dbData = await getTokenInfoFromDB(tokenIncaseAddress);
    if (dbData) {
      return dbData;
    }
    createTokenInfo(tokenAddress);
  } catch (e) {
    console.log("query token info failed:", tokenAddress);
  }
  return null;
}

/**
 * 查询数据库中的 token 信息，并写入 Redis 缓存
 */
export async function getTokenInfoFromDB(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  const sql = `
    SELECT token_address as mint, name, symbol, decimals, total_supply as supply, meta_uri as uri, logo_url as image
    FROM tokens
    WHERE token_address = ?
  `;
  try {
    const result = await commonQuery<TokenInfo>(sql, [tokenAddress]);
    const dbData = result[0];
    if (dbData) {
      await redisClient.hset(
        tokenInfoCache,
        tokenAddress,
        JSON.stringify(dbData),
      );
      return dbData;
    }
    return null;
  } catch (error) {
    console.error("Error in getTokenInfoFromDB:", error);
    throw error;
  }
}

export async function createTokenInfo(
  tokenAddress: string,
): Promise<TokenInfo | null> {
  const tokenMetadata = await fetchTokenMetadataService.fetch(tokenAddress);
  if (!tokenMetadata) {
    const emptyTokenInfo: TokenInfo = {
      mint: tokenAddress,
      name: "",
      symbol: "",
      decimals: 0,
      supply: 0,
      uri: "",
      image: "",
    };
    await redisClient.hset(
      tokenInfoCache,
      tokenAddress,
      JSON.stringify(emptyTokenInfo),
    );
    return emptyTokenInfo;
  }

  const tokenInfo: TokenInfo = {
    mint: tokenAddress,
    name: tokenMetadata.name,
    symbol: tokenMetadata.symbol,
    decimals: tokenMetadata.decimals,
    supply: tokenMetadata.supply,
    uri: tokenMetadata.uri,
    image: tokenMetadata.image,
  };

  const insertSql = `
            INSERT INTO tokens (token_address, name, symbol, decimals, total_supply, meta_uri, logo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY
            UPDATE
                name =
            VALUES (name), symbol =
            VALUES (symbol), decimals =
            VALUES (decimals), total_supply =
            VALUES (total_supply), meta_uri =
            VALUES (meta_uri), logo_url =
            VALUES (logo_url)
        `;

  const result = await commonQuery(insertSql, [
    tokenAddress,
    tokenInfo.name,
    tokenInfo.symbol,
    tokenInfo.decimals,
    tokenInfo.supply,
    tokenInfo.uri,
    tokenInfo.image,
  ]);

  // if ((result as any).affectedRows > 0) {
  //     return await getTokenInfoFromDB(tokenAddress);
  // }
  return null;
}
// const tokenInfo =await getTokenInfoUseCache("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
// console.log(tokenInfo);
