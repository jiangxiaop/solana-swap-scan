/// <reference types="node" />
import { AccountsCoder, Idl } from "@coral-xyz/anchor";
export declare class SplTokenAccountsCoder<A extends string = string> implements AccountsCoder {
    constructor(_idl: Idl);
    encode<T = any>(accountName: A, account: T): Promise<Buffer>;
    decode<T = any>(accountName: A, ix: Buffer): T;
    decodeUnchecked<T = any>(accountName: A, ix: Buffer): T;
    memcmp(accountName: A, _appendData?: Buffer): {
        dataSize?: number;
        offset?: number;
        bytes?: string;
    };
    size(accountName: A): number;
}
//# sourceMappingURL=accounts.d.ts.map