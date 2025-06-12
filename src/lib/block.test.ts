import { expect } from "jsr:@std/expect";
import { getBlockHashBySlotNumber, getBlockTransactionsByProtocol } from "./block.ts";
import solana_connect_instance from "./solana.ts";

Deno.test("getBlockHashBySlotNumber", async () => {
  const blockhash = await getBlockHashBySlotNumber(solana_connect_instance.getConnection(), 344319878);
  console.log(blockhash);
  expect(blockhash).toBe("3QqnZmfk4aJKxrWduBZm2uWrowNsC22fgHUVM9J5F7bqkwPcKEZX3yhZ3xDSqnVUobe2g5mRiXjckGWPzsH9Nshp");
});

Deno.test("getBlockTransactionsByProtocol", async () => {
  const blockTransactions = await getBlockTransactionsByProtocol(344319878, "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

  blockTransactions?.protocolTransactions.forEach(tx => {
    console.log(tx.transaction.transaction.signatures);
  });

  expect(blockTransactions?.protocolTransactions.length).toBe(1);
});