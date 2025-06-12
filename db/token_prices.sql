CREATE TABLE t_token_prices (
    mint STRING NOT NULL,  -- 代币铸造地址
    timestamp BIGINT NOT NULL,  -- 时间戳
    price_usd DECIMAL(38, 18),  -- 美元价格
    price_sol DECIMAL(38, 18),  -- SOL价格
    liquidity_usd DECIMAL(38, 18),  -- 美元流动性
    volume_24h DECIMAL(38, 18),  -- 24小时交易量
    source STRING,  -- 价格数据源
    PRIMARY KEY (mint, timestamp),
    INDEX idx_timestamp (timestamp)
)