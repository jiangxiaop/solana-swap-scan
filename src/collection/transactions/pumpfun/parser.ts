import { PumpFunParser } from 'solana-parser';
import { ParsedTransactionWithMeta } from '@solana/web3.js';
import { MOCK_CREATE_TOKEN_TRANS_DATA } from "../../../mock/trans.ts";
import { Buffer } from "node:buffer";

export const parseTransaction = (transaction: ParsedTransactionWithMeta) => {
    const parser = new PumpFunParser();

    // Parse single transaction
    const parsedTx = parser.parse(transaction);
    return parsedTx;
}

const data = Buffer.from("G3KpTd7rY3YGAAAAY29zdGNvBgAAAENPU1RDT0MAAABodHRwczovL2lwZnMuaW8vaXBmcy9RbWM0QnVybzdLSjV5UDRlVkpBY1lrbmtZTW1KSGlOOEhDakU1TDJDZUt6SEdhOlEIjuMgLqO9oCG/DwmmKUI6OumpYdid9c9VgKRsLPyrA5VAu/Y/pBxVz5lPWMygUNE67dUCDTCedqlFTYRUi5gcnBHWDouZ68hPeNswkhDfdiJPBamtiNdQ+uX95dwymBycEdYOi5nryE942zCSEN92Ik8Fqa2I11D65f3l3DKCEUVoAAAAAAAQ2EfjzwMAAKwj/AYAAAAAeMX7UdECAACAxqR+jQMA", 'base64').slice(0, 8)

console.log(data);