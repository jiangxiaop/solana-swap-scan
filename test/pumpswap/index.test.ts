import { DexParser } from "../../src/collection/dex-parser.ts";
import { PumpswapEventParser } from "../../src/collection/parser/pumpswap/event.ts";
import { TransactionAdapter } from "../../src/collection/parser/transaction-adapter.ts";
import { SolanaTransaction } from "../../src/type/index.ts";

Deno.test("test the pumpswap buy event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpswap/pumpswap-buy.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new PumpswapEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});


Deno.test("test the pumpswap create event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpswap/pumpswap-create.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const parser = new DexParser();
    const result = parser.parseAll(tx);
    console.log(result);
});

Deno.test("test the pumpswap sell event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpswap/pumpswap-sell.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    // const adapter = new TransactionAdapter(tx);
    const parser = new DexParser();
    const events = parser.parseAll(tx);
    const result = parser.formatAllTrades(events);
    console.log(result);
});

Deno.test("test the pumpswap withdraw event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpswap/pumpswap-withdraw.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new PumpswapEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});


Deno.test("test the pumpswap add liquidity event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpswap/pumpswap-add-liquidity.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new PumpswapEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});