import { TokenSwapFilterData } from "../../type/swap.ts";
import { TokenNormSnapShot } from "../../type/transaction.ts";


interface SnapshotTokenFilterData {
    [tokenPoolKey: string]: TokenNormSnapShot
}

const initTokenNormSnapShot = (): TokenNormSnapShot => {
    return {
        blockHeight: 0,
        blockTime: 0,
        tokenAddress: "",
        buyAmount: 0,
        sellAmount: 0,
        buyCount: 0,
        sellCount: 0,
        highPrice: 0,
        lowPrice: 0,
        startPrice: 0,
        endPrice: 0,
        avgPrice: 0,
        poolAddress: "",
        snapShotBlockTime: 0,
    }
}

export const snapshotTokenValueByTxData = (txs: TokenSwapFilterData[]): TokenNormSnapShot[] => {
    const result: SnapshotTokenFilterData = {};

    for (const tx of txs) {
        const tokenPoolKey = `${tx.tokenAddress}-${tx.poolAddress}`;
        const tokenNormSnapShot = result[tokenPoolKey] || initTokenNormSnapShot();

        if (tokenNormSnapShot.blockTime === 0) {
            tokenNormSnapShot.blockTime = tx.transactionTime;
        }

        if (tokenNormSnapShot.blockHeight === 0) {
            tokenNormSnapShot.blockHeight = tx.blockHeight;
        }

        if (tx.isBuy) {
            tokenNormSnapShot.buyAmount += tx.tokenAmount;
            tokenNormSnapShot.buyCount += 1;
        } else {
            tokenNormSnapShot.sellAmount += tx.tokenAmount;
            tokenNormSnapShot.sellCount += 1;
        }

        if (tx.quotePrice > tokenNormSnapShot.highPrice) {
            tokenNormSnapShot.highPrice = tx.quotePrice;
        }

        if (tx.quotePrice < tokenNormSnapShot.lowPrice || tokenNormSnapShot.lowPrice === 0) {
            tokenNormSnapShot.lowPrice = tx.quotePrice;
        }

        if (tokenNormSnapShot.startPrice === 0) {
            tokenNormSnapShot.startPrice = tx.quotePrice;
        }

        if (tokenNormSnapShot.avgPrice === 0) {
            tokenNormSnapShot.avgPrice = tx.quotePrice;
        } else {
            tokenNormSnapShot.avgPrice = (tokenNormSnapShot.avgPrice + tx.quotePrice) / 2;
        }

        tokenNormSnapShot.endPrice = tx.quotePrice;

        tokenNormSnapShot.snapShotBlockTime = tx.transactionTime - tokenNormSnapShot.blockTime;

        tokenNormSnapShot.poolAddress = tx.poolAddress;
        tokenNormSnapShot.tokenAddress = tx.tokenAddress;

        result[tokenPoolKey] = tokenNormSnapShot;
    }

    const resultSnapShot: TokenNormSnapShot[] = [];

    for (const tokenPoolKey in result) {
        resultSnapShot.push(result[tokenPoolKey]);
    }

    return resultSnapShot;

}
