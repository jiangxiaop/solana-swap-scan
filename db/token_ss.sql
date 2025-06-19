CREATE TABLE token_ss (
    id INT AUTO_INCREMENT PRIMARY KEY,
    block_height INT NOT NULL,
    block_time DATETIME NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    buy_amount DECIMAL(36,18) NOT NULL,
    sell_amount DECIMAL(36,18) NOT NULL,
    buy_count INT NOT NULL,
    sell_count INT NOT NULL,
    high_price DECIMAL(36,18) NOT NULL,
    low_price DECIMAL(36,18) NOT NULL,
    start_price DECIMAL(36,18) NOT NULL,
    end_price DECIMAL(36,18) NOT NULL,
    avg_price DECIMAL(36,18) NOT NULL,
    pool_address VARCHAR(42) NOT NULL,
    snap_shot_block_time INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)