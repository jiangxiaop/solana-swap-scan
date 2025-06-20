-- 创建 wallet_trading_ss 表
CREATE TABLE IF NOT EXISTS wallet_trading_ss (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    snapshot_time DATETIME NOT NULL,
    per_tl_trading_value JSON NOT NULL COMMENT '每笔交易详情数组: [{tokenAddress, tradeAmount, tokenPrice, tokenUsdPrice, tradeSolAmount, tradeUsdAmount, isBuy}]',
    total_buy_sol_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
    total_buy_usd_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
    total_sell_sol_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
    total_sell_usd_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
    buy_count INT NOT NULL DEFAULT 0,
    sell_count INT NOT NULL DEFAULT 0,
    sol_price DECIMAL(36,18) NOT NULL DEFAULT 0,
    win_count INT NOT NULL DEFAULT 0,
    lose_count INT NOT NULL DEFAULT 0,
    current_token_value JSON NOT NULL COMMENT '当前持仓代币详情数组: [{tokenAddress, tokenBalance, tokenWeightBuyPrice, tokenWeightBuyUsdPrice, tokenWeightSellPrice, tokenWeightSellUsdPrice, tokenSolPrice, tokenUsdPrice, totalBuyAmount, totalSellAmount, transactions}]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_wallet_address (wallet_address),
    INDEX idx_snapshot_time (snapshot_time),
    INDEX idx_wallet_time (wallet_address, snapshot_time),
    INDEX idx_win_lose (win_count, lose_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='钱包交易快照表';

create index idx_wallet_address_snapshot_time on wallet_trading_ss (wallet_address, snapshot_time);

-- 添加字段注释说明
-- wallet_address: 钱包地址
-- snapshot_time: 快照时间
-- per_tl_trading_value: 每笔交易详情（JSON数组）
--   - tokenAddress: 代币地址
--   - tradeAmount: 交易数量
--   - tokenPrice: 代币价格
--   - tokenUsdPrice: 代币USD价格
--   - tradeSolAmount: 交易SOL数量
--   - tradeUsdAmount: 交易USD数量
--   - isBuy: 是否为买入
-- total_buy_sol_amount: 总买入SOL数量
-- total_buy_usd_amount: 总买入USD数量
-- total_sell_sol_amount: 总卖出SOL数量
-- total_sell_usd_amount: 总卖出USD数量
-- buy_count: 买入次数
-- sell_count: 卖出次数
-- sol_price: SOL价格
-- win_count: 盈利次数
-- lose_count: 亏损次数
-- current_token_value: 当前持仓代币详情（JSON数组）
--   - tokenAddress: 代币地址
--   - tokenBalance: 代币余额
--   - tokenWeightBuyPrice: 代币加权买入价格
--   - tokenWeightBuyUsdPrice: 代币加权买入USD价格
--   - tokenWeightSellPrice: 代币加权卖出价格
--   - tokenWeightSellUsdPrice: 代币加权卖出USD价格
--   - tokenSolPrice: 代币SOL价格
--   - tokenUsdPrice: 代币USD价格
--   - totalBuyAmount: 总买入数量
--   - totalSellAmount: 总卖出数量
--   - transactions: 交易次数

-- 创建用于 JSON 查询的虚拟列（可选，用于提高查询性能）
-- ALTER TABLE wallet_trading_ss 
-- ADD COLUMN total_pnl_usd AS (total_sell_usd_amount - total_buy_usd_amount) VIRTUAL,
-- ADD INDEX idx_total_pnl_usd (total_pnl_usd);

-- 示例 JSON 查询语句
-- 查询特定代币的交易记录：
-- SELECT wallet_address, snapshot_time 
-- FROM wallet_trading_ss 
-- WHERE JSON_CONTAINS(per_tl_trading_value, JSON_OBJECT('tokenAddress', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'));

-- 查询当前持有特定代币的钱包：
-- SELECT wallet_address, current_token_value
-- FROM wallet_trading_ss 
-- WHERE JSON_CONTAINS(current_token_value, JSON_OBJECT('tokenAddress', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'));


-- 获取过去3天内符合条件的活跃钱包
-- 使用LEFT JOIN避免排序规则冲突
SELECT 
    wallet_address,
    SUM(buy_count + w.sell_count) as total_transactions,
    SUM(w.buy_count) as total_buy_count,
    COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(token.value, '$.tokenAddress'))) as unique_tokens
FROM wallet_trading_ss w
CROSS JOIN JSON_TABLE(w.current_token_value, '$[*]' COLUMNS (
    value JSON PATH '$'
)) AS token
LEFT JOIN smart_money_address sma ON w.wallet_address = sma.address COLLATE utf8mb4_unicode_ci
WHERE w.snapshot_time >= '2025-06-1 00:00:00'
  AND sma.address IS NULL  -- 排除已存在的聪明钱地址
GROUP BY w.wallet_address
HAVING total_transactions >= 1
   AND total_buy_count >= 1
   AND unique_tokens >= 1
ORDER BY total_transactions DESC;



select * from wallet_trading_ss where snapshot_time >= '2025-06-18 00:00:00' and snapshot_time <= '2025-06-19 00:00:00' and wallet_address = '88FTcA1qojpqX6tmSDMB8XbErQUue938T288zWK3GAAv';