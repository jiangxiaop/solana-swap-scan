import { load } from "https://deno.land/std@0.202.0/dotenv/mod.ts";
import { SolanaBlockDataHandler } from "../../src/service/SolanaBlockDataHandler.ts";
import { loadEnv } from "../mock.ts";
import { SwapTransactionToken } from "../../src/type/swap.ts";

Deno.test("getTxList", async () => {
    await loadEnv();
    const data = await SolanaBlockDataHandler.getDataByBlockHeightRange(347649520, 347649570);
    console.log("got one time window tx data length is ", data.length);

    Deno.writeTextFileSync("txdata.json", JSON.stringify(data));
});


Deno.test("filterTokenData", async () => {
    await loadEnv();
    const data = await SolanaBlockDataHandler.getXDaysData(1749549921, 3);
    console.log(data.length);

    const filteredData = SolanaBlockDataHandler.filterTokenData(data);
    Deno.writeTextFileSync("filteredData.json", JSON.stringify(filteredData));
});

