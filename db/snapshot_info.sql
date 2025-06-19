-- 创建 snapshot_info 表
CREATE TABLE IF NOT EXISTS snapshot_info (
    id int NOT NULL PRIMARY KEY AUTO_INCREMENT COMMENT 'Primary Key',
    timestamp BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('TokenNormSnapShot', 'SnapShotForWalletTrading')),
    blockHeight BIGINT NOT NULL,
    blockTime BIGINT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_snapshot_info_timestamp ON snapshot_info(timestamp);
CREATE INDEX IF NOT EXISTS idx_snapshot_info_type ON snapshot_info(type);
CREATE INDEX IF NOT EXISTS idx_snapshot_info_block_height ON snapshot_info(blockHeight);

-- 添加注释说明
-- id: 主键，自增
-- timestamp: 快照时间戳
-- type: 快照类型，枚举值：TokenNormSnapShot, SnapShotForWalletTrading
-- blockHeight: 区块高度
-- blockTime: 区块时间
-- created_at: 记录创建时间
-- updated_at: 记录更新时间
