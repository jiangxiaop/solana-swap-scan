import { DexParser } from "../../src/collection/dex-parser.ts";
import { SolanaTransaction } from "../../src/type/trade.ts";

Deno.test("test get meteora remove lp value", async () => {
    const transaction = Deno.readTextFileSync("./test/meteora/rm-lp.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const parser = new DexParser();
    const data = parser.parseAll(tx);
    console.log(data);
})


Deno.test("test get meteora add lp value", async () => {
    const transaction = Deno.readTextFileSync("./test/meteora/add-lp.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const parser = new DexParser();
    const data = parser.parseAll(tx);
    console.log(data);
})