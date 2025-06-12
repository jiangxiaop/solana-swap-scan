import { DexParser } from "../../src/collection/dex-parser.ts";
import { PumpfunEventParser } from "../../src/collection/parser/pumpfun/event.ts";
import { TransactionAdapter } from "../../src/collection/parser/transaction-adapter.ts";
import { SolanaTransaction } from "../../src/type/index.ts";

Deno.test("test the pumpfun create token event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpfun/pumpfun-create-token.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const parser = new DexParser();
    const trades = parser.parseAllComplete(tx);
    console.log(trades);
});

Deno.test("test the pumpfun buy event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpfun/pumpfun-trade.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new PumpfunEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});

Deno.test("test the pumpfun complete event parser", () => {
    const transaction = Deno.readTextFileSync("./test/pumpfun/pumpfun-sell.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new PumpfunEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});
