import { Layout } from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
export declare const pubKey: (property: string) => Layout<PublicKey>;
export declare const uint64: (property: string) => Layout<bigint>;
export declare const uint128: (property: string) => Layout<bigint>;
export declare const stringLayout: (property: string) => Layout<string>;
export declare const boolean: (property: string) => Layout<boolean>;
//# sourceMappingURL=layout.d.ts.map