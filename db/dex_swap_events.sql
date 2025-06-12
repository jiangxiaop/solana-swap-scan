CREATE TABLE t_dex_swap_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_signature STRING NOT NULL,  -- 交易签名
    block_time BIGINT NOT NULL,  -- 区块时间戳
    slot BIGINT NOT NULL,  -- 区块高度
    user_address STRING NOT NULL,  -- 用户地址(交易发起人)
    protocol STRING NOT NULL,  -- 'jupiter', 'raydium', 'orca', 'pumpfun', 'meteora'
    pool_address STRING,  -- 交易池地址
    token_in_mint STRING NOT NULL,  -- 输入代币地址
    token_out_mint STRING NOT NULL,  -- 输出代币地址
    token_in_amount DECIMAL(38, 18) NOT NULL,  -- 输入代币数量(已调整精度)
    token_out_amount DECIMAL(38, 18) NOT NULL,  -- 输出代币数量(已调整精度)
    token_in_amount_raw BIGINT NOT NULL,  -- 输入代币原始数量
    token_out_amount_raw BIGINT NOT NULL,  -- 输出代币原始数量
    token_in_symbol STRING,  -- 输入代币符号
    token_out_symbol STRING,  -- 输出代币符号
    token_in_decimals INT,  -- 输入代币精度
    token_out_decimals INT,  -- 输出代币精度
    usd_value DECIMAL(38, 18),  -- 交易美元价值
    price_impact DECIMAL(10, 6),  -- 价格影响百分比
    fee_amount DECIMAL(38, 18),  -- 手续费(以输出代币计)
    is_direct_route BOOLEAN,  -- 是否为直接交换
    route_count INT,  -- 路由跳数(Jupiter特有)
    slippage_bps INT,  -- 滑点(基点)
    status STRING NOT NULL DEFAULT 'success',  -- 'success', 'failed'
    error_message STRING,  -- 错误信息
    raw_data TEXT,  -- 原始交易数据
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 处理时间
    INDEX idx_transaction_signature (transaction_signature),
    INDEX idx_block_time (block_time),
    INDEX idx_user_address (user_address),
    INDEX idx_protocol (protocol),
    INDEX idx_token_in_mint (token_in_mint),
    INDEX idx_token_out_mint (token_out_mint),
    INDEX idx_pool_address (pool_address)
)