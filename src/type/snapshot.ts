export enum SnapShotType {
    TokenNormSnapShot = "TokenNormSnapShot",
    SnapShotForWalletTrading = "SnapShotForWalletTrading",
}


export interface SnapshotInfo {
    timestamp: number;
    type: SnapShotType;
    blockHeight: number;
    blockTime: number;
}
