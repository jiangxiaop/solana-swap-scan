import solana_connect_instance from "../../../lib/solana.ts";

export const getBlockValue = async (blockNumber: number) => {
    const connection = solana_connect_instance.getConnection();
    const block = await connection.getBlock(
        blockNumber,
        {
            maxSupportedTransactionVersion: 0,
        }
    );
    return block;
}

const _main_ = async () => {
    const block = await getBlockValue(344756476);
    console.log(block);
    Deno.writeTextFileSync("block.json", JSON.stringify(block, null, 2));
}

_main_();