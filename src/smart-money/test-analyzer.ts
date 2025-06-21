import { SmartMoneyAnalyzer, SmartMoneyCategory, type SmartMoneyMetrics, type SmartMoneyAnalysisResult } from "./index.ts";
import { SnapShotForWalletTrading } from "../type/transaction.ts";

/**
 * 测试版本的聪明钱分析器，使用内存中的模拟数据
 */
export class TestSmartMoneyAnalyzer extends SmartMoneyAnalyzer {
    private testSnapshots: SnapShotForWalletTrading[] = [];

    constructor(testSnapshots: SnapShotForWalletTrading[]) {
        super();
        this.testSnapshots = testSnapshots;
    }

    /**
     * Override 获取钱包快照的方法
     */
    protected override async getWalletSnapshotsInRange(
        walletAddress: string, 
        startTime: number, 
        endTime: number
    ): Promise<SnapShotForWalletTrading[]> {
        // 首先尝试按时间范围过滤
        let filteredSnapshots = this.testSnapshots.filter(snapshot => {
            // snapshotTime 是字符串格式的秒级时间戳，直接转换为数字
            const snapshotTime = parseInt(snapshot.snapshotTime);
            return snapshot.walletAddress === walletAddress &&
                   snapshotTime >= startTime &&
                   snapshotTime <= endTime;
        });
        
        // 如果按时间范围找不到数据，就返回该钱包的所有快照（mock数据模式）
        if (filteredSnapshots.length === 0) {
            filteredSnapshots = this.testSnapshots.filter(snapshot => {
                return snapshot.walletAddress === walletAddress;
            });
            
            if (filteredSnapshots.length > 0) {
                console.log(`🔄 时间范围查询无结果，返回钱包 ${walletAddress.slice(0, 8)}... 的所有 ${filteredSnapshots.length} 个快照`);
            }
        }
        
        // 按时间倒序排列 (DESC)
        filteredSnapshots.sort((a, b) => 
            parseInt(b.snapshotTime) - parseInt(a.snapshotTime)
        );
        
        // console.log(`测试查询钱包 ${walletAddress.slice(0, 8)}... 在时间范围 ${startTime}-${endTime} 找到 ${filteredSnapshots.length} 个快照`);
        
        return filteredSnapshots;
    }

    /**
     * Override 获取基准快照的方法
     */
    protected override async getBaselineSnapshot(
        walletAddress: string, 
        analysisStartTime: number
    ): Promise<SnapShotForWalletTrading | null> {
        // 获取分析开始时间之前的最后一次快照
        let snapshots = this.testSnapshots.filter(snapshot => {
            // snapshotTime 是字符串格式的秒级时间戳，直接转换为数字
            const snapshotTime = parseInt(snapshot.snapshotTime);
            return snapshot.walletAddress === walletAddress && snapshotTime < analysisStartTime;
        });
        
        // 如果找不到基准快照，返回null（对于mock数据是正常的）
        if (snapshots.length === 0) {
            return null;
        }
        
        // 按时间倒序排列，取最新的一个
        snapshots.sort((a, b) => 
            parseInt(b.snapshotTime) - parseInt(a.snapshotTime)
        );
        
        return snapshots[0];
    }
} 