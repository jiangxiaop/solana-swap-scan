CREATE TABLE t_token_metadata (
    mint STRING PRIMARY KEY,  -- 代币铸造地址
    name STRING,  -- 代币名称
    symbol STRING,  -- 代币符号
    decimals INT,  -- 小数位数
    icon_url STRING,  -- 图标URL
    is_risk_token BOOLEAN DEFAULT FALSE,  -- 是否为风险代币
    total_supply DECIMAL(38, 18),  -- 总供应量
    first_seen_timestamp BIGINT,  -- 首次发现时间
    last_updated_timestamp BIGINT,  -- 最后更新时间
    INDEX idx_symbol (symbol),
    INDEX idx_is_risk_token (is_risk_token)
)