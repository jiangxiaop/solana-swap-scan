import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";
import { SolanaBlockDataHandler } from "../../src/service/SolanaBlockDataHandler.ts";
import { loadEnv } from "../mock.ts";

Deno.test("getTxList", async () => {
    await loadEnv();
    const data = await SolanaBlockDataHandler.getXDaysData(1749549921, 3000);
    Deno.writeTextFileSync("txdata.json", JSON.stringify(data));
});