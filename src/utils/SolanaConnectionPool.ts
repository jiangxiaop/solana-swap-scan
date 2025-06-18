// utils/SolanaConnectionPool.ts
import { Connection } from "@solana/web3.js";

const rpcArray = [
    "https://quaint-stylish-sheet.solana-mainnet.quiknode.pro/d8713d2a2f0cd3e3c83b07fee686c373d9288a9f/",
    "https://tiniest-quick-market.solana-mainnet.quiknode.pro/951dec21bfb308079eaae30b31e289cf19a2a9d0/",
    "https://virulent-multi-sea.solana-mainnet.quiknode.pro/734cd703cef2a3fdc72ab8f9d807796f01508502/"
];

export class SolanaConnectionPool {
    private static connections: Connection[] = rpcArray.map(
        (rpc) => new Connection(rpc)
    );

    /**
     * 根据索引获取连接对象（支持循环取模）
     * @param index
     * @returns Connection 实例
     */
    public static getConnection(index: number): Connection {
        const len = SolanaConnectionPool.connections.length;
        if (len === 0) {
            throw new Error("Connection pool is empty.");
        }
        return SolanaConnectionPool.connections[index % len];
    }

    /**
     * 获取连接池长度
     */
    public static getPoolSize(): number {
        return SolanaConnectionPool.connections.length;
    }
}