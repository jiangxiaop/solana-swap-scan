CREATE TABLE t_user_trading_summary (
    user_address STRING NOT NULL,
    period_end BIGINT NOT NULL,  -- 统计周期结束时间戳
    period_type STRING NOT NULL,  -- '1d', '7d', '30d', 'all'
    total_swaps INT,  -- 总交换次数
    unique_tokens_bought INT,  -- 购买的不同代币数量
    unique_tokens_sold INT,  -- 卖出的不同代币数量
    total_volume_usd DECIMAL(38, 18),  -- 总交易量(USD)
    avg_swap_size_usd DECIMAL(38, 18),  -- 平均交易规模(USD)
    risk_tokens_ratio DECIMAL(5, 4),  -- 风险代币交易比例
    profit_usd DECIMAL(38, 18),  -- 估算收益(USD)
    PRIMARY KEY (user_address, period_type, period_end),
    INDEX idx_period_end (period_end)
)