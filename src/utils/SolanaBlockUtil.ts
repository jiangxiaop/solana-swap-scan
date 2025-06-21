// src/utils/SolanaBlockUtil.ts
import solana_connect_instance from "../lib/solana.ts";
import {SolanaConnectionPool} from "./SolanaConnectionPool.ts";

export class SolanaBlockUtil {
  private static connection = solana_connect_instance.getConnection(); // 使用你的 Solana 连接实例o

  /**
   * 获取最新 slot（当前区块）
   */
  public static async getLatestSlot(): Promise<number> {
    return await this.connection.getSlot("confirmed");
  }

  /**
   * 获取最新 block height（链上高度）
   */
  public static async getLatestBlockHeight(): Promise<number> {
    return await this.connection.getBlockHeight("confirmed");
  }

  /**
   * 获取 slot 和 block height 一起返回
   */
  public static async getLatestBlockInfo(): Promise<
    { slot: number; blockHeight: number }
  > {
    const [slot, blockHeight] = await Promise.all([
      this.getLatestSlot(),
      this.getLatestBlockHeight(),
    ]);
    return { slot, blockHeight };
  }

  public static async getFirstAvailableBlock(): Promise<number> {
    return await this.connection.getFirstAvailableBlock();
  }

  public static async getBlockData (blockNumber: number,index:number): Promise<{ data: any; skip: boolean }> {
    try {
      const connection = SolanaConnectionPool.getConnection(index);//solana_connect_instance.getConnection();
      const block = await connection.getBlock(blockNumber, {
        maxSupportedTransactionVersion: 0,
      });
      return { data: block, skip: false };
    } catch (error) {
      if (error.code === -32007) {
        // console.log(JSON.stringify(error, null, 2));
        return {data:null, skip: true };
      }else {
        console.error('getBlockData error:', error);
      }
    }
    return { data: null, skip: false };
  };
}
// const latestSlot = await SolanaBlockUtil.getLatestSlot();
// console.log(latestSlot);
// const data=await SolanaBlockUtil.getBlockData(latestSlot,0);
// console.log(data);
