import { expect } from "jsr:@std/expect";

import solana_connect_instance from "../src/lib/solana.ts";
import { DexParser } from "../src/collection/dex-parser.ts";
import { SolanaTransaction } from "../src/type/index.ts";

// Deno.test("测试收集数据信息", async () => {
//     const transactions = await collectProtocolTransactions(Protocol.RAYDIUM);
//     console.log(transactions);
//     expect(transactions).toBeDefined();
// })

const getBlockValue = async (blockNumber: number) => {
    const connection = solana_connect_instance.getConnection();
    const block = await connection.getBlock(
        blockNumber,
        {
            // commitment: "confirmed",
            // transactionDetails: "full",
            maxSupportedTransactionVersion: 0,
            // rewards: false,
        },
    );
    return block;
}

Deno.test("测试获取交易信息", async () => {
    const startTime = Date.now();
    const parser = new DexParser();
    const blockNumber = 347797409;
    const transactions = await parser.parsePerBlock(blockNumber);

    const endTime = Date.now();
    console.log(`解析时间: ${endTime - startTime}ms`);

})
// Deno.test("测试获取区块解析pumpfun信息", async () => {
//     const pumpfunTransactions = await filterPumpfunTransactions(345366320);
//     Deno.writeTextFileSync("pumpfunTransactions-collection.json", JSON.stringify(pumpfunTransactions, null, 2));
//     expect(pumpfunTransactions).toBeDefined();
// })

// Deno.test("测试获取交易信息", async () => {
//     const transaction = await getTransactionBySignature("trjspFNZZnmBMeYVMuWbkDt6BE7bCRMprhwoUBtNzKtTN3ygMXzZ1m4qL5SaWDTFu7ACiRAJdvZAjqMnPWxAnb4");
//     console.log(transaction);
// })