import { collectProtocolTransactions } from "./collectProtocolTransactions.ts";
import { Protocol } from "../type/enum.ts";
import { expect } from "jsr:@std/expect/expect";

Deno.test("测试收集数据信息", async () => {
    const transactions = await collectProtocolTransactions(Protocol.RAYDIUM);
    console.log(transactions);
    expect(transactions).toBeDefined();
})