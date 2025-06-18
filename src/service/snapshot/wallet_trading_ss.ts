import { commonQuery } from "../../utils/mysqlHelper.ts";
import { SnapShotForWalletTrading } from "../../type/transaction.ts";

// 数据库表字段接口（snake_case）
export interface WalletTradingSnapshotDB {
    id?: number;
    wallet_address: string;
    snapshot_time: string; // DATETIME 格式
    per_tl_trading_value: string; // JSON 字符串
    total_buy_sol_amount: number;
    total_buy_usd_amount: number;
    total_sell_sol_amount: number;
    total_sell_usd_amount: number;
    buy_count: number;
    sell_count: number;
    sol_price: number;
    win_count: number;
    lose_count: number;
    current_token_value: string; // JSON 字符串
    created_at?: string;
    updated_at?: string;
}

/**
 * 将 SnapShotForWalletTrading 转换为数据库格式
 */
function walletTradingSnapShotToDb(snapshot: SnapShotForWalletTrading): Omit<WalletTradingSnapshotDB, 'id' | 'created_at' | 'updated_at'> {
    // 验证时间值的有效性
    let validSnapshotTime: string;
    try {
        // 检查 snapshotTime 是否为有效值
        if (!snapshot.snapshotTime || snapshot.snapshotTime.trim() === '') {
            console.warn(`Invalid snapshotTime (empty or null): "${snapshot.snapshotTime}", using current time`);
            validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        } else {
            // 尝试创建 Date 对象验证时间格式
            const date = new Date(snapshot.snapshotTime);
            if (isNaN(date.getTime())) {
                console.warn(`Invalid snapshotTime format: "${snapshot.snapshotTime}", using current time`);
                validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
            } else {
                validSnapshotTime = date.toISOString().slice(0, 19).replace('T', ' ');
            }
        }
    } catch (error) {
        console.error(`Error processing snapshotTime "${snapshot.snapshotTime}":`, error);
        console.log('Using current time as fallback');
        validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    
    return {
        wallet_address: snapshot.walletAddress,
        snapshot_time: validSnapshotTime,
        per_tl_trading_value: JSON.stringify(snapshot.perTLTradingValue),
        total_buy_sol_amount: snapshot.totalBuySolAmount,
        total_buy_usd_amount: snapshot.totalBuyUsdAmount,
        total_sell_sol_amount: snapshot.totalSellSolAmount,
        total_sell_usd_amount: snapshot.totalSellUsdAmount,
        buy_count: snapshot.buy_count,
        sell_count: snapshot.sell_count,
        sol_price: snapshot.solPrice,
        win_count: snapshot.winCount,
        lose_count: snapshot.loseCount,
        current_token_value: JSON.stringify(snapshot.currentTokenValue)
    };
}

/**
 * 将数据库格式转换为 SnapShotForWalletTrading
 */
function dbToWalletTradingSnapShot(dbRecord: WalletTradingSnapshotDB): SnapShotForWalletTrading {
    return {
        walletAddress: dbRecord.wallet_address,
        snapshotTime: new Date(dbRecord.snapshot_time).toISOString(),
        perTLTradingValue: JSON.parse(dbRecord.per_tl_trading_value),
        totalBuySolAmount: dbRecord.total_buy_sol_amount,
        totalBuyUsdAmount: dbRecord.total_buy_usd_amount,
        totalSellSolAmount: dbRecord.total_sell_sol_amount,
        totalSellUsdAmount: dbRecord.total_sell_usd_amount,
        buy_count: dbRecord.buy_count,
        sell_count: dbRecord.sell_count,
        solPrice: dbRecord.sol_price,
        winCount: dbRecord.win_count,
        loseCount: dbRecord.lose_count,
        currentTokenValue: JSON.parse(dbRecord.current_token_value)
    };
}

/**
 * 创建新的钱包交易快照记录
 */
export async function createWalletTradingSnapshot(snapshot: SnapShotForWalletTrading): Promise<SnapShotForWalletTrading | null> {
    const dbData = walletTradingSnapShotToDb(snapshot);
    const insertSql = `
        INSERT INTO wallet_trading_ss (
            wallet_address, snapshot_time, per_tl_trading_value, total_buy_sol_amount,
            total_buy_usd_amount, total_sell_sol_amount, total_sell_usd_amount,
            buy_count, sell_count, sol_price, win_count, lose_count, current_token_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const result = await commonQuery(insertSql, [
            dbData.wallet_address,
            dbData.snapshot_time,
            dbData.per_tl_trading_value,
            dbData.total_buy_sol_amount,
            dbData.total_buy_usd_amount,
            dbData.total_sell_sol_amount,
            dbData.total_sell_usd_amount,
            dbData.buy_count,
            dbData.sell_count,
            dbData.sol_price,
            dbData.win_count,
            dbData.lose_count,
            dbData.current_token_value
        ]);

        const insertId = (result as any).insertId;
        if (insertId) {
            return await getWalletTradingSnapshotById(insertId);
        }
    } catch (error) {
        console.error("Error creating wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 批量创建钱包交易快照记录
 */
export async function batchCreateWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<number> {
    if (snapshots.length === 0) return 0;

    try {
        const values = snapshots.map(() => 
            '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).join(', ');
        
        const sql = `
            INSERT INTO wallet_trading_ss (
                wallet_address, snapshot_time, per_tl_trading_value, total_buy_sol_amount,
                total_buy_usd_amount, total_sell_sol_amount, total_sell_usd_amount,
                buy_count, sell_count, sol_price, win_count, lose_count, current_token_value
            ) VALUES ${values}
        `;

        const params: any[] = [];
        snapshots.forEach(snapshot => {
            const dbData = walletTradingSnapShotToDb(snapshot);
            params.push(
                dbData.wallet_address,
                dbData.snapshot_time,
                dbData.per_tl_trading_value,
                dbData.total_buy_sol_amount,
                dbData.total_buy_usd_amount,
                dbData.total_sell_sol_amount,
                dbData.total_sell_usd_amount,
                dbData.buy_count,
                dbData.sell_count,
                dbData.sol_price,
                dbData.win_count,
                dbData.lose_count,
                dbData.current_token_value
            );
        });

        const result = await commonQuery(sql, params);
        return (result as any).affectedRows;
    } catch (error) {
        console.error("Error batch creating wallet trading snapshots:", error);
        return 0;
    }
}

/**
 * 根据 ID 获取钱包交易快照
 */
export async function getWalletTradingSnapshotById(id: number): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss WHERE id = ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [id]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting wallet trading snapshot by id:", error);
    }
    return null;
}

/**
 * 根据钱包地址获取快照列表
 */
export async function getWalletTradingSnapshotsByAddress(
    walletAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallet trading snapshots by address:", error);
        return [];
    }
}

/**
 * 根据时间范围获取快照
 */
export async function getWalletTradingSnapshotsByTimeRange(
    startTime: string,
    endTime: string,
    walletAddress?: string
): Promise<SnapShotForWalletTrading[]> {
    try {
        let sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE snapshot_time >= ? AND snapshot_time <= ?
        `;
        const params: any[] = [startTime, endTime];

        if (walletAddress) {
            sql += ` AND wallet_address = ?`;
            params.push(walletAddress);
        }

        sql += ` ORDER BY snapshot_time DESC, id DESC`;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, params);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallet trading snapshots by time range:", error);
        return [];
    }
}

/**
 * 获取指定钱包的最新快照
 */
export async function getLatestWalletTradingSnapshot(walletAddress: string): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT 1
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot:", error);
    }
    return null;
}

/**
 * 获取指定钱包在指定时间之前的最后一次快照
 */

export async function getLatestWalletTradingSnapshotBeforeTime(walletAddress: string, timestamp: number): Promise<SnapShotForWalletTrading | null> {
    try {
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE wallet_address = ? AND snapshot_time < ?
            ORDER BY snapshot_time DESC, id DESC
            LIMIT 1
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [walletAddress, timestamp]);
        if (result[0]) {
            return dbToWalletTradingSnapShot(result[0]);
        }
    } catch (error) {
        console.error("Error getting latest wallet trading snapshot before time:", error);
    }
    return null;
}

/**
 * 根据盈亏情况获取钱包列表
 */
export async function getWalletsByProfitLoss(
    minWinCount?: number,
    minLoseCount?: number,
    minPnlUsd?: number,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        let sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE 1=1
        `;
        const params: any[] = [];

        if (minWinCount !== undefined) {
            sql += ` AND win_count >= ?`;
            params.push(minWinCount);
        }

        if (minLoseCount !== undefined) {
            sql += ` AND lose_count >= ?`;
            params.push(minLoseCount);
        }

        if (minPnlUsd !== undefined) {
            sql += ` AND (total_sell_usd_amount - total_buy_usd_amount) >= ?`;
            params.push(minPnlUsd);
        }

        sql += ` ORDER BY (total_sell_usd_amount - total_buy_usd_amount) DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, params);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets by profit loss:", error);
        return [];
    }
}

/**
 * 查询持有特定代币的钱包
 */
export async function getWalletsHoldingToken(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE JSON_CONTAINS(current_token_value, JSON_OBJECT('tokenAddress', ?))
            ORDER BY snapshot_time DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [tokenAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets holding token:", error);
        return [];
    }
}

/**
 * 查询交易过特定代币的钱包
 */
export async function getWalletsTradedToken(
    tokenAddress: string,
    page: number = 1,
    pageSize: number = 50
): Promise<SnapShotForWalletTrading[]> {
    try {
        const offset = (page - 1) * pageSize;
        const sql = `
            SELECT * FROM wallet_trading_ss 
            WHERE JSON_CONTAINS(per_tl_trading_value, JSON_OBJECT('tokenAddress', ?))
            ORDER BY snapshot_time DESC
            LIMIT ? OFFSET ?
        `;

        const result = await commonQuery<WalletTradingSnapshotDB>(sql, [tokenAddress, pageSize, offset]);
        return result.map(dbToWalletTradingSnapShot);
    } catch (error) {
        console.error("Error getting wallets traded token:", error);
        return [];
    }
}

/**
 * 更新钱包交易快照
 */
export async function updateWalletTradingSnapshot(id: number, updateData: Partial<SnapShotForWalletTrading>): Promise<boolean> {
    try {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (updateData.walletAddress !== undefined) {
            setClauses.push('wallet_address = ?');
            params.push(updateData.walletAddress);
        }
        if (updateData.snapshotTime !== undefined) {
            // 验证时间值的有效性
            let validSnapshotTime: string;
            try {
                if (!updateData.snapshotTime || updateData.snapshotTime.trim() === '') {
                    console.warn(`Invalid snapshotTime in update (empty or null): "${updateData.snapshotTime}", using current time`);
                    validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                } else {
                    const date = new Date(updateData.snapshotTime);
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid snapshotTime format in update: "${updateData.snapshotTime}", using current time`);
                        validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    } else {
                        validSnapshotTime = date.toISOString().slice(0, 19).replace('T', ' ');
                    }
                }
            } catch (error) {
                console.error(`Error processing snapshotTime in update "${updateData.snapshotTime}":`, error);
                console.log('Using current time as fallback');
                validSnapshotTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
            }
            
            setClauses.push('snapshot_time = ?');
            params.push(validSnapshotTime);
        }
        if (updateData.perTLTradingValue !== undefined) {
            setClauses.push('per_tl_trading_value = ?');
            params.push(JSON.stringify(updateData.perTLTradingValue));
        }
        if (updateData.totalBuySolAmount !== undefined) {
            setClauses.push('total_buy_sol_amount = ?');
            params.push(updateData.totalBuySolAmount);
        }
        if (updateData.totalBuyUsdAmount !== undefined) {
            setClauses.push('total_buy_usd_amount = ?');
            params.push(updateData.totalBuyUsdAmount);
        }
        if (updateData.totalSellSolAmount !== undefined) {
            setClauses.push('total_sell_sol_amount = ?');
            params.push(updateData.totalSellSolAmount);
        }
        if (updateData.totalSellUsdAmount !== undefined) {
            setClauses.push('total_sell_usd_amount = ?');
            params.push(updateData.totalSellUsdAmount);
        }
        if (updateData.buy_count !== undefined) {
            setClauses.push('buy_count = ?');
            params.push(updateData.buy_count);
        }
        if (updateData.sell_count !== undefined) {
            setClauses.push('sell_count = ?');
            params.push(updateData.sell_count);
        }
        if (updateData.solPrice !== undefined) {
            setClauses.push('sol_price = ?');
            params.push(updateData.solPrice);
        }
        if (updateData.winCount !== undefined) {
            setClauses.push('win_count = ?');
            params.push(updateData.winCount);
        }
        if (updateData.loseCount !== undefined) {
            setClauses.push('lose_count = ?');
            params.push(updateData.loseCount);
        }
        if (updateData.currentTokenValue !== undefined) {
            setClauses.push('current_token_value = ?');
            params.push(JSON.stringify(updateData.currentTokenValue));
        }

        if (setClauses.length === 0) {
            return false;
        }

        params.push(id);
        const sql = `
            UPDATE wallet_trading_ss 
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const result = await commonQuery(sql, params);
        return (result as any).affectedRows > 0;
    } catch (error) {
        console.error("Error updating wallet trading snapshot:", error);
        return false;
    }
}

/**
 * 删除钱包交易快照
 */
export async function deleteWalletTradingSnapshot(id: number): Promise<boolean> {
    try {
        const sql = `DELETE FROM wallet_trading_ss WHERE id = ?`;
        const result = await commonQuery(sql, [id]);
        return (result as any).affectedRows > 0;
    } catch (error) {
        console.error("Error deleting wallet trading snapshot:", error);
        return false;
    }
}

/**
 * 删除指定钱包地址的所有快照
 */
export async function deleteWalletTradingSnapshotsByAddress(walletAddress: string): Promise<number> {
    try {
        const sql = `DELETE FROM wallet_trading_ss WHERE wallet_address = ?`;
        const result = await commonQuery(sql, [walletAddress]);
        return (result as any).affectedRows;
    } catch (error) {
        console.error("Error deleting wallet trading snapshots by address:", error);
        return 0;
    }
}

/**
 * 获取钱包交易快照总数
 */
export async function getWalletTradingSnapshotCount(walletAddress?: string): Promise<number> {
    try {
        let sql = `SELECT COUNT(*) as count FROM wallet_trading_ss`;
        const params: any[] = [];

        if (walletAddress) {
            sql += ` WHERE wallet_address = ?`;
            params.push(walletAddress);
        }

        const result = await commonQuery<{ count: number }>(sql, params);
        return result[0]?.count || 0;
    } catch (error) {
        console.error("Error getting wallet trading snapshot count:", error);
        return 0;
    }
}

/**
 * 获取钱包交易统计信息
 */
export async function getWalletTradingStats(walletAddress?: string): Promise<{
    totalWallets: number;
    totalPnlUsd: number;
    avgWinCount: number;
    avgLoseCount: number;
    totalBuyVolume: number;
    totalSellVolume: number;
} | null> {
    try {
        let sql = `
            SELECT 
                COUNT(DISTINCT wallet_address) as total_wallets,
                SUM(total_sell_usd_amount - total_buy_usd_amount) as total_pnl_usd,
                AVG(win_count) as avg_win_count,
                AVG(lose_count) as avg_lose_count,
                SUM(total_buy_usd_amount) as total_buy_volume,
                SUM(total_sell_usd_amount) as total_sell_volume
            FROM wallet_trading_ss
        `;
        const params: any[] = [];

        if (walletAddress) {
            sql += ` WHERE wallet_address = ?`;
            params.push(walletAddress);
        }

        const result = await commonQuery<{
            total_wallets: number;
            total_pnl_usd: number;
            avg_win_count: number;
            avg_lose_count: number;
            total_buy_volume: number;
            total_sell_volume: number;
        }>(sql, params);

        if (result[0]) {
            return {
                totalWallets: result[0].total_wallets,
                totalPnlUsd: result[0].total_pnl_usd,
                avgWinCount: result[0].avg_win_count,
                avgLoseCount: result[0].avg_lose_count,
                totalBuyVolume: result[0].total_buy_volume,
                totalSellVolume: result[0].total_sell_volume
            };
        }
    } catch (error) {
        console.error("Error getting wallet trading stats:", error);
    }
    return null;
}

/**
 * 保存钱包交易快照数据到数据库
 */
export async function saveWalletTradingSnapshots(snapshots: SnapShotForWalletTrading[]): Promise<boolean> {
    try {
        const insertedCount = await batchCreateWalletTradingSnapshots(snapshots);
        console.log(`Successfully saved ${insertedCount} wallet trading snapshots to database`);
        return insertedCount > 0;
    } catch (error) {
        console.error("Error saving wallet trading snapshots:", error);
        return false;
    }
}
