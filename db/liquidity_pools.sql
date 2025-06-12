CREATE TABLE t_liquidity_pools (
    pool_address STRING PRIMARY KEY,  -- 池地址
    protocol STRING NOT NULL,  -- 'jupiter', 'raydium', 'orca', 'pumpfun', 'meteora'
    token_a_mint STRING NOT NULL,  -- A代币铸造地址
    token_b_mint STRING NOT NULL,  -- B代币铸造地址
    token_a_symbol STRING,  -- A代币符号
    token_b_symbol STRING,  -- B代币符号
    token_a_amount DECIMAL(38, 18),  -- A代币数量
    token_b_amount DECIMAL(38, 18),  -- B代币数量
    liquidity_usd DECIMAL(38, 18),  -- 池子美元流动性 
    fee_rate DECIMAL(10, 6),  -- 手续费率
    is_verified BOOLEAN DEFAULT FALSE,  -- 是否为认证池
    created_timestamp BIGINT,  -- 创建时间
    last_updated_timestamp BIGINT,  -- 最后更新时间
    INDEX idx_protocol (protocol),
    INDEX idx_token_a_mint (token_a_mint),
    INDEX idx_token_b_mint (token_b_mint)
)