import { InitPool, Deposit, Withdraw, SwapBaseIn, SwapBaseOut, PoolInfo } from './types';
export declare const INIT_POOL_LAYOUT: import("@solana/buffer-layout").Structure<InitPool>;
export declare const DEPOSIT_LAYOUT: import("@solana/buffer-layout").Structure<Deposit>;
export declare const WITHDRAW_LAYOUT: import("@solana/buffer-layout").Structure<Withdraw>;
export declare const SWAP_BASE_IN_LAYOUT: import("@solana/buffer-layout").Structure<SwapBaseIn>;
export declare const SWAP_BASE_OUT_LAYOUT: import("@solana/buffer-layout").Structure<SwapBaseOut>;
export declare const RAY_AMM_V4_POOL_LAYOUT: import("@solana/buffer-layout").Structure<PoolInfo & {
    padding: Uint8Array;
}>;
//# sourceMappingURL=layout.d.ts.map