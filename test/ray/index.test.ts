
import { RaydiumLaunchpadEventParser } from "../../src/collection/parser/ray/launchpad-event.ts";
import { TransactionAdapter } from "../../src/collection/parser/transaction-adapter.ts";
import { DexInfo, SolanaTransaction } from "../../src/type/index.ts";

Deno.test("test the raydium launchpad create pair event parser", () => {
    const transaction = Deno.readTextFileSync("./test/ray/ray-launchpad-create-pair.json");
    const tx = JSON.parse(transaction) as SolanaTransaction;
    const adapter = new TransactionAdapter(tx);
    const parser = new RaydiumLaunchpadEventParser(adapter);
    const events = parser.processEvents();
    console.log(events);
});