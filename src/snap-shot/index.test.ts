import { assertEquals, assert } from "jsr:@std/assert";
import { stub, restore } from "jsr:@std/testing/mock";
import { SnapshotForTokenAndWalletTrading } from "./index.ts";
import { SolanaBlockDataHandler } from "../service/SolanaBlockDataHandler.ts";
import { SwapTransactionToken } from "../type/swap.ts";
import * as snapshotService from "../service/snapshot/snapshot.ts";
import client from "../../config/db.ts";
import { loadEnv } from "../../test/mock.ts";

// 加载测试数据
let testData: any[] = [];

async function loadTestData(): Promise<any[]> {
    try {
        const data = await Deno.readTextFile("./txdata.json");
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to load test data:", error);
        return [];
    }
}

// 将 txdata.json 数据转换为 SwapTransactionToken 格式
function convertToSwapTransactionToken(rawData: any[]): SwapTransactionToken[] {
    return rawData.map((item, index) => ({
        tx_hash: item.tx_hash,
        transaction_time: item.transaction_time,
        pool_address: `pool_${item.token_address.slice(-8)}`, // 生成模拟池子地址
        block_height: 100000 + index, // 生成模拟区块高度
        wallet_address: item.wallet_address,
        token_amount: item.token_amount,
        token_symbol: item.token_symbol || "Unknown",
        token_address: item.token_address,
        quote_symbol: item.quote_symbol,
        quote_amount: item.quote_amount,
        quote_address: item.quote_address,
        quote_price: item.quote_price,
        usd_price: item.usd_price,
        usd_amount: item.usd_amount
    }));
}

// Mock 函数
function mockGetXDaysDataByTimestamp(
    startTimestamp: number,
    endTimestamp: number,
    pageNum: number,
    pageSize: number
): Promise<SwapTransactionToken[]> {
    if (!testData.length) return Promise.resolve([]);

    // 根据时间范围过滤数据
    const filteredData = testData.filter(item => {
        const itemTime = parseInt(item.transaction_time);
        return itemTime >= startTimestamp && itemTime <= endTimestamp;
    });

    // 分页处理
    const startIndex = (pageNum - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return Promise.resolve(convertToSwapTransactionToken(paginatedData));
}

Deno.test("快照系统完整流程测试", async () => {
    testData = await loadTestData();
    await loadEnv();

    console.log(`📊 加载了 ${testData.length} 条测试数据`);

    try {
        // Mock SolanaBlockDataHandler.getXDaysDataByTimestamp
        const getXDaysDataStub = stub(
            SolanaBlockDataHandler,
            "getXDaysDataByTimestamp",
            mockGetXDaysDataByTimestamp
        );

        // Mock getLatestSnapshotByType - 模拟首次运行
        // const getLatestSnapshotStub = stub(
        //     snapshotService,
        //     "getLatestSnapshotByType",
        //     () => Promise.resolve(null)
        // );

        console.log("🚀 开始执行快照测试...");

        // 执行快照函数
        const result = await SnapshotForTokenAndWalletTrading();

        console.log("📋 快照执行结果:", result);

        // 验证基本返回结果
        assert(typeof result === "object", "返回结果应该是对象");
        assert(typeof result.tokenSnapShot === "boolean", "tokenSnapShot 应该是布尔值");
        assert(typeof result.walletSnapShot === "boolean", "walletSnapShot 应该是布尔值");
        assert(typeof result.processedWindows === "number", "processedWindows 应该是数字");
        assert(typeof result.message === "string", "message 应该是字符串");

        console.log(`✅ 测试完成 - 处理了 ${result.processedWindows} 个时间窗口`);
        console.log(`📝 消息: ${result.message}`);

    } finally {
        await client.close();
        restore();
    }
});

Deno.test("数据转换正确性测试", async () => {
    testData = await loadTestData();
    if (testData.length > 0) {
        // 测试少量数据的转换
        const sampleData = testData.slice(0, 5);
        const convertedData = convertToSwapTransactionToken(sampleData);

        console.log("📝 原始数据示例:", sampleData[0]);
        console.log("🔄 转换后数据示例:", convertedData[0]);

        // 验证数据转换的正确性
        assertEquals(convertedData.length, sampleData.length, "转换后数据长度应该匹配");

        if (convertedData.length > 0) {
            const first = convertedData[0];
            const original = sampleData[0];

            assertEquals(first.tx_hash, original.tx_hash, "tx_hash 应该匹配");
            assertEquals(first.transaction_time, original.transaction_time, "transaction_time 应该匹配");
            assertEquals(first.wallet_address, original.wallet_address, "wallet_address 应该匹配");
            assertEquals(first.token_amount, original.token_amount, "token_amount 应该匹配");
            assertEquals(first.token_address, original.token_address, "token_address 应该匹配");

            // 验证新增字段
            assert(typeof first.pool_address === "string", "pool_address 应该是字符串");
            assert(typeof first.block_height === "number", "block_height 应该是数字");
            assert(first.block_height > 0, "block_height 应该大于0");
        }

        console.log("✅ 数据转换测试通过");
    } else {
        console.log("⚠️  没有测试数据可用");
    }
});