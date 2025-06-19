import { SnapshotInfo, SnapShotType } from "../../type/snapshot.ts";
import { createSnapshot, getLatestSnapshotByType, getSnapshotById } from "./snapshot.ts";
import { assertEquals } from "jsr:@std/assert";
import client from "../../../config/db.ts";
import { TokenNormSnapShot } from "../../type/transaction.ts";
import { batchCreateTokenSnapshots, createTokenSnapshot } from "./token_ss.ts";

Deno.test("test for add the snapshot rows on snapshot database", async () => {
    try {
        const snapshotInfo: SnapshotInfo = {
            timestamp: 1718534400,
            type: SnapShotType.TokenNormSnapShot,
            blockHeight: 1234567890,
            blockTime: 1718534400,
        };

        const result = await createSnapshot(snapshotInfo);
        console.log("result:", result);

        // 验证返回的快照信息不为空
        assertEquals(result !== null, true);

        // 如果返回了快照信息，验证基本字段
        if (result) {
            assertEquals(result, 11);
        }
    } finally {
        // 确保在测试结束后关闭数据库连接
        try {
            await client.close();
        } catch (error) {
            console.warn("Error closing database connection:", error);
        }
    }
});


Deno.test("test for get the snapshot rows on snapshot database", async () => {
    try {
        const snapshotInfo = await getSnapshotById(11);
        console.log("snapshotInfo:", snapshotInfo);

        assertEquals(snapshotInfo?.id, 11);
    } finally {
        // 确保在测试结束后关闭数据库连接
        try {
            await client.close();
        } catch (error) {
            console.warn("Error closing database connection:", error);
        }
    }
});


Deno.test("test for get the last snapshot rows on snapshot database", async () => {
    const snapshotInfo = await getLatestSnapshotByType(SnapShotType.TokenNormSnapShot);
    console.log("snapshotInfo:", snapshotInfo);

    assertEquals(snapshotInfo?.id, 11);

    await client.close();
})



Deno.test("test for the token ss insert", async () => {
    const tokenSS: TokenNormSnapShot = {
        blockHeight: 1234567890,
        blockTime: "1718534400",
        tokenAddress: "0x1234567890",
        buyAmount: 100,
        sellAmount: 200,
        buyCount: 10,
        sellCount: 20,
        highPrice: 100,
        lowPrice: 50,
        startPrice: 75,
        endPrice: 125,
        avgPrice: 100,
        poolAddress: "0x1234567890",
        snapShotBlockTime: 1718534400,
    }

    const resultId = await createTokenSnapshot(tokenSS);
    console.log("resultId:", resultId);

    assertEquals(resultId, 1);

    await client.close();
})



Deno.test("test insert multiple token ss", async () => {
    const tokenSS: TokenNormSnapShot[] = [
        {
            blockHeight: 1234567890,
            blockTime: "1718534400",
            tokenAddress: "0x1234567890",
            buyAmount: 100,
            sellAmount: 200,
            buyCount: 10,
            sellCount: 20,
            highPrice: 100,
            lowPrice: 50,
            startPrice: 75,
            endPrice: 125,
            avgPrice: 100,
            poolAddress: "0x1234567890",
            snapShotBlockTime: 1718534400,
        },
        {
            blockHeight: 1234567890,
            blockTime: "1718534400",
            tokenAddress: "0x1234567890",
            buyAmount: 100,
            sellAmount: 200,
            buyCount: 10,
            sellCount: 20,
            highPrice: 100,
            lowPrice: 50,
            startPrice: 75,
            endPrice: 125,
            avgPrice: 100,
            poolAddress: "0x1234567890",
            snapShotBlockTime: 1718534400,
        }
    ]

    const result = await batchCreateTokenSnapshots(tokenSS);
    console.log("result:", result);

    assertEquals(result, 3);

    await client.close();
})