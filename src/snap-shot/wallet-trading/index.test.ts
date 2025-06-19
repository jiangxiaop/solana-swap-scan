import { expect } from "jsr:@std/expect/expect";
import { assertEquals } from "jsr:@std/assert";
import { Stub, stub } from "jsr:@std/testing/mock";


import { TOKENS } from "../../constant/token.ts";
import { TokenSwapFilterData } from "../../type/swap.ts";
import { SnapShotForWalletTrading } from "../../type/transaction.ts";
import { 
    snapshotWalletTradingByTxData, 
    walletTradingService,
    getTokenClearanceHistory,
    calculateTotalClearancePnL,
    getClearedTokensList
} from "./index.ts";
import { SolanaBlockDataHandler } from "../../service/SolanaBlockDataHandler.ts";
import client from "../../../config/db.ts";


const mockData: TokenSwapFilterData[] = [
    {
        userAddress: "0x11111",
        poolAddress: "0x1234567890",
        txHash: "0x1234567890",
        isBuy: true,
        blockHeight: 100,
        tokenSymbol: "TEST_TOKEN",
        tokenAddress: "0x1234567890",
        quoteSymbol: "SOL",
        quoteAddress: TOKENS.SOL,
        quotePrice: 1,
        usdPrice: 160,
        usdAmount: 80,
        transactionTime: "100",
        tokenAmount: 1,
        quoteAmount: 1,
    },
    {
        userAddress: "0x22222",
        poolAddress: "0x1234567890",
        txHash: "0x1234567890",
        isBuy: true,
        blockHeight: 100,
        tokenSymbol: "TEST_TOKEN",
        tokenAddress: "0x1234567890",
        quoteSymbol: "SOL",
        quoteAddress: TOKENS.SOL,
        quotePrice: 1,
        usdPrice: 160,
        usdAmount: 160,
        transactionTime: "100",
        tokenAmount: 1,
        quoteAmount: 1,
    },
    {
        userAddress: "0x22222",
        poolAddress: "0x1234567890",
        txHash: "0x1234567890",
        isBuy: false,
        blockHeight: 100,
        tokenSymbol: "TEST_TOKEN",
        tokenAddress: "0x1234567890",
        quoteSymbol: "SOL",
        quoteAddress: TOKENS.SOL,
        quotePrice: 1,
        usdPrice: 160,
        usdAmount: 320,
        transactionTime: "100",
        tokenAmount: 2,
        quoteAmount: 2,
    }
];


const mock_per_tw_snapshot_data: SnapShotForWalletTrading[] = [
    {
        walletAddress: "0x11111",
        snapshotTime: "99", // 秒级时间戳
        perTLTradingValue: [
            {
                tokenAddress: "0x1234567890",
                tradeAmount: 1,
                tokenPrice: 0.5,
                tokenUsdPrice: 80,
                tradeSolAmount: 0.5,
                tradeUsdAmount: 40,
                isBuy: true,
            }
        ],
        totalBuySolAmount: 0.5,
        totalBuyUsdAmount: 80,
        totalSellSolAmount: 0,
        totalSellUsdAmount: 0,
        buy_count: 1,
        sell_count: 0,
        solPrice: 160,
        winCount: 0,
        loseCount: 0,
        currentTokenValue: [{
            tokenAddress: "0x1234567890",
            tokenBalance: 1,
            tokenSolPrice: 0.5,
            tokenUsdPrice: 80,
            tokenWeightBuyPrice: 0.5,
            tokenWeightBuyUsdPrice: 80,
            tokenWeightSellPrice: 0,
            tokenWeightSellUsdPrice: 0,
            totalBuyAmount: 1,
            totalSellAmount: 0,
            transactions: 1,
        }],
    },
    {
        walletAddress: "0x22222",
        snapshotTime: "99", // 秒级时间戳
        perTLTradingValue: [
            {
                tokenAddress: "0x1234567890",
                tradeAmount: 4,
                tokenPrice: 0.5,
                tokenUsdPrice: 80,
                tradeSolAmount: 2,
                tradeUsdAmount: 160,
                isBuy: true,
            },
            {
                tokenAddress: "0x1234567890",
                tradeAmount: 2,
                tokenPrice: 0.5,
                tokenUsdPrice: 80,
                tradeSolAmount: 1,
                tradeUsdAmount: 160,
                isBuy: false,
            }
        ],
        totalBuySolAmount: 2,
        totalBuyUsdAmount: 320,
        totalSellSolAmount: 1,
        totalSellUsdAmount: 160,
        buy_count: 1,
        sell_count: 1,
        solPrice: 160,
        winCount: 0,
        loseCount: 0,
        currentTokenValue: [{
            tokenAddress: "0x1234567890",
            tokenBalance: 2,
            tokenSolPrice: 1,
            tokenUsdPrice: 0.5,
            tokenWeightBuyPrice: 0.5,
            tokenWeightBuyUsdPrice: 80,
            tokenWeightSellPrice: 0.5,
            tokenWeightSellUsdPrice: 80,
            totalBuyAmount: 1,
            totalSellAmount: 1,
            transactions: 2,
        }],
    }
]


const expect_snapshot_mockData: SnapShotForWalletTrading[] =
    [
        {
            walletAddress: "0x11111",
            snapshotTime: "100", // 秒级时间戳
            perTLTradingValue: [
                {
                    tokenAddress: "0x1234567890",
                    tradeAmount: 1,
                    tokenPrice: 1,
                    tokenUsdPrice: 160,
                    tradeSolAmount: 1,
                    tradeUsdAmount: 80,
                    isBuy: true
                }
            ],
            totalBuySolAmount: 1.5,
            totalBuyUsdAmount: 160,
            totalSellSolAmount: 0,
            totalSellUsdAmount: 0,
            buy_count: 2,
            sell_count: 0,
            solPrice: 160,
            winCount: 0,
            loseCount: 0,
            currentTokenValue: [
                {
                    tokenAddress: "0x1234567890",
                    tokenBalance: 2,
                    tokenSolPrice: 1,
                    tokenUsdPrice: 160,
                    tokenWeightBuyPrice: 0.75,
                    tokenWeightBuyUsdPrice: 120,
                    tokenWeightSellPrice: 0,
                    tokenWeightSellUsdPrice: 0,
                    totalBuyAmount: 2,
                    totalSellAmount: 0,
                    transactions: 2,
                    clearanceHistory: []
                }
            ]
        },
        {
            walletAddress: "0x22222",
            snapshotTime: "100", // 秒级时间戳
            perTLTradingValue: [
                {
                    tokenAddress: "0x1234567890",
                    tradeAmount: 1,
                    tokenPrice: 1,
                    tokenUsdPrice: 160,
                    tradeSolAmount: 1,
                    tradeUsdAmount: 160,
                    isBuy: true
                },
                {
                    tokenAddress: "0x1234567890",
                    tradeAmount: 2,
                    tokenPrice: 1,
                    tokenUsdPrice: 160,
                    tradeSolAmount: 2,
                    tradeUsdAmount: 320,
                    isBuy: false
                }
            ],
            totalBuySolAmount: 1.5,
            totalBuyUsdAmount: 240,
            totalSellSolAmount: 2,
            totalSellUsdAmount: 320,
            buy_count: 2,
            sell_count: 1,
            solPrice: 160,
            winCount: 1,
            loseCount: 0,
            currentTokenValue: [
                {
                    tokenAddress: "0x1234567890",
                    tokenBalance: 0,
                    tokenSolPrice: 1,
                    tokenUsdPrice: 160,
                    tokenWeightBuyPrice: 0.75,
                    tokenWeightBuyUsdPrice: 120,
                    tokenWeightSellPrice: 1,
                    tokenWeightSellUsdPrice: 160,
                    totalBuyAmount: 2,
                    totalSellAmount: 2,
                    transactions: 3,
                    isCleared: true,
                    clearanceHistory: [{
                        clearanceTime: "100",
                        totalBuyAmount: 2,
                        totalSellAmount: 2,
                        avgBuyPrice: 0.75,
                        avgBuyUsdPrice: 120,
                        avgSellPrice: 1,
                        avgSellUsdPrice: 160,
                        transactions: 3,
                        isProfit: true,
                        pnlSol: 0.5,
                        pnlUsd: 80
                    }]
                }
            ]
        }
    ]

// [
//     {
//         walletAddress: "0x11111",
//         snapshotTime: 100,
//         perTLTradingValue: [
//             {
//                 tokenAddress: "0x1234567890",
//                 tradeAmount: 1,
//                 tokenPrice: 1,
//                 tokenUsdPrice: 160,
//                 tradeSolAmount: 1,
//                 tradeUsdAmount: 160,
//                 isBuy: true,
//             }
//         ],
//         totalBuySolAmount: 1.5,
//         totalBuyUsdAmount: 240,
//         totalSellSolAmount: 0,
//         totalSellUsdAmount: 0,
//         buy_count: 2,
//         sell_count: 0,
//         solPrice: 160,
//         winCount: 0,
//         loseCount: 0,
//         currentTokenValue: [{
//             tokenAddress: "0x1234567890",
//             tokenBalance: 2,
//             tokenWeightBuyPrice: 0.75,
//             tokenWeightBuyUsdPrice: 120,
//             tokenWeightSellPrice: 0,
//             tokenSolPrice: 1,
//             tokenUsdPrice: 160,
//             tokenWeightSellUsdPrice: 0,
//             totalBuyAmount: 2,
//             totalSellAmount: 0,
//             transactions: 2,
//         }],
//     },
//     {
//         walletAddress: "0x22222",
//         snapshotTime: 100,
//         perTLTradingValue: [
//             {
//                 tokenAddress: "0x1234567890",
//                 tradeAmount: 1,
//                 tokenPrice: 1,
//                 tokenUsdPrice: 160,
//                 tradeSolAmount: 1,
//                 tradeUsdAmount: 160,
//                 isBuy: true,
//             },
//             {
//                 tokenAddress: "0x1234567890",
//                 tradeAmount: 1,
//                 tokenPrice: 1,
//                 tokenUsdPrice: 160,
//                 tradeSolAmount: 1,
//                 tradeUsdAmount: 160,
//                 isBuy: false,
//             }
//         ],
//         totalBuySolAmount: 3,
//         totalBuyUsdAmount: 480,
//         totalSellSolAmount: 3,
//         totalSellUsdAmount: 480,
//         buy_count: 2,
//         sell_count: 2,
//         solPrice: 160,
//         winCount: 0,
//         loseCount: 0,
//         currentTokenValue: [{
//             tokenAddress: "0x1234567890",
//             tokenBalance: 2,
//             tokenSolPrice: 1,
//             tokenUsdPrice: 160,
//             tokenWeightBuyPrice: 0.6,
//             tokenWeightBuyUsdPrice: 96,
//             tokenWeightSellPrice: 0.6667,
//             tokenWeightSellUsdPrice: 106.6667,
//             totalBuyAmount: 2,
//             totalSellAmount: 2,
//             transactions: 2,
//         }]
//     }

// ]


Deno.test("snapshotTokenValueByTxData", async () => {
    const initWalletTradingStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(mock_per_tw_snapshot_data[0])
    );

    try {
        const result = await snapshotWalletTradingByTxData(mockData);
        console.log(result);
        expect(result).toEqual(expect_snapshot_mockData);
    } finally {
        initWalletTradingStub.restore();
    }
});

// 新增测试用例：用户清仓代币
Deno.test("snapshotTokenValueByTxData - 用户清仓代币测试", async () => {
    // 模拟历史数据：用户持有一些代币
    const mockHistoryData: SnapShotForWalletTrading[] = [
        {
            walletAddress: "0xClearUser",
            snapshotTime: "99", // 秒级时间戳
            perTLTradingValue: [],
            totalBuySolAmount: 5,
            totalBuyUsdAmount: 800,
            totalSellSolAmount: 0,
            totalSellUsdAmount: 0,
            buy_count: 2,
            sell_count: 0,
            solPrice: 160,
            winCount: 0,
            loseCount: 0,
            currentTokenValue: [{
                tokenAddress: "0x1234567890",
                tokenBalance: 10, // 持有10个代币
                tokenSolPrice: 0.5,
                tokenUsdPrice: 80,
                tokenWeightBuyPrice: 0.5,
                tokenWeightBuyUsdPrice: 80,
                tokenWeightSellPrice: 0,
                tokenWeightSellUsdPrice: 0,
                totalBuyAmount: 10, // 总共买入10个
                totalSellAmount: 0, // 还没有卖出
                transactions: 2,
            }],
        }
    ];

    // 模拟新交易：用户卖出几乎所有代币（清仓）
    const mockClearanceData: TokenSwapFilterData[] = [
        {
            userAddress: "0xClearUser",
            poolAddress: "0x1234567890",
            txHash: "0xClearTx1",
            isBuy: false,
            blockHeight: 100,
            tokenSymbol: "TEST_TOKEN",
            tokenAddress: "0x1234567890",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 1,
            usdPrice: 160,
            usdAmount: 1600, // 卖出价值
            transactionTime: "100",
            tokenAmount: 10, // 卖出10个代币，完全清仓
            quoteAmount: 10,
        }
    ];

    // 期望结果：代币应该从currentTokenValue中被移除
    const expectedClearanceResult: SnapShotForWalletTrading[] = [
        {
            walletAddress: "0xClearUser",
            snapshotTime: "100", // 秒级时间戳
            perTLTradingValue: [
                {
                    tokenAddress: "0x1234567890",
                    tradeAmount: 10,
                    tokenPrice: 1,
                    tokenUsdPrice: 160,
                    tradeSolAmount: 10,
                    tradeUsdAmount: 1600,
                    isBuy: false,
                }
            ],
            totalBuySolAmount: 5,
            totalBuyUsdAmount: 800,
            totalSellSolAmount: 10,
            totalSellUsdAmount: 1600,
            buy_count: 2,
            sell_count: 1,
            solPrice: 160,
            winCount: 1, // 清仓成功算作一次盈利
            loseCount: 0,
            currentTokenValue: [{  // 现在保留代币记录，但标记为已清仓
                tokenAddress: "0x1234567890",
                tokenBalance: 0, // 余额为0
                tokenSolPrice: 1,
                tokenUsdPrice: 160,
                tokenWeightBuyPrice: 0.5,
                tokenWeightBuyUsdPrice: 80,
                tokenWeightSellPrice: 1,
                tokenWeightSellUsdPrice: 160,
                totalBuyAmount: 10,
                totalSellAmount: 10,
                transactions: 3,
                isCleared: true, // 标记为已清仓
                clearanceHistory: [{  // 包含清仓历史
                    clearanceTime: "100",
                    totalBuyAmount: 10,
                    totalSellAmount: 10,
                    avgBuyPrice: 0.5,
                    avgBuyUsdPrice: 80,
                    avgSellPrice: 1,
                    avgSellUsdPrice: 160,
                    transactions: 3,
                    isProfit: true,
                    pnlSol: 5, // (1 - 0.5) * 10 = 5 SOL
                    pnlUsd: 800 // (160 - 80) * 10 = 800 USD
                }]
            }],
        }
    ];

    const clearanceStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(mockHistoryData[0])
    );

    try {
        const result = await snapshotWalletTradingByTxData(mockClearanceData);
        console.log("清仓测试结果:", JSON.stringify(result, null, 2));
        expect(result).toEqual(expectedClearanceResult);
    } finally {
        clearanceStub.restore();
    }
});

// 新增测试用例：复杂清仓场景（部分清仓 + 盈亏混合）
Deno.test("snapshotTokenValueByTxData - 复杂清仓场景测试", async () => {
    // 模拟历史数据：用户持有两种代币
    const mockComplexHistoryData: SnapShotForWalletTrading[] = [
        {
            walletAddress: "0xComplexUser",
            snapshotTime: "99", // 秒级时间戳 
            perTLTradingValue: [],
            totalBuySolAmount: 15,
            totalBuyUsdAmount: 2400,
            totalSellSolAmount: 0,
            totalSellUsdAmount: 0,
            buy_count: 3,
            sell_count: 0,
            solPrice: 160,
            winCount: 0,
            loseCount: 0,
            currentTokenValue: [
                {
                    tokenAddress: "0xToken1", // 盈利代币，将被清仓
                    tokenBalance: 10,
                    tokenSolPrice: 1,
                    tokenUsdPrice: 160,
                    tokenWeightBuyPrice: 0.5, // 买入价格 0.5 SOL
                    tokenWeightBuyUsdPrice: 80, // 买入价格 80 USD
                    tokenWeightSellPrice: 0,
                    tokenWeightSellUsdPrice: 0,
                    totalBuyAmount: 10,
                    totalSellAmount: 0,
                    transactions: 2,
                },
                {
                    tokenAddress: "0xToken2", // 亏损代币，将被清仓
                    tokenBalance: 5,
                    tokenSolPrice: 1,
                    tokenUsdPrice: 160,
                    tokenWeightBuyPrice: 2, // 买入价格 2 SOL
                    tokenWeightBuyUsdPrice: 320, // 买入价格 320 USD
                    tokenWeightSellPrice: 0,
                    tokenWeightSellUsdPrice: 0,
                    totalBuyAmount: 5,
                    totalSellAmount: 0,
                    transactions: 1,
                }
            ],
        }
    ];

    // 模拟新交易：清仓两种代币
    const mockComplexClearanceData: TokenSwapFilterData[] = [
        // 清仓Token1（盈利）- 卖出价格 1.5 SOL > 买入价格 0.5 SOL
        {
            userAddress: "0xComplexUser",
            poolAddress: "0x1234567890",
            txHash: "0xClearTx1",
            isBuy: false,
            blockHeight: 100,
            tokenSymbol: "TOKEN1",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 1.5,
            usdPrice: 240,
            usdAmount: 2400, // 10 * 240 = 2400
            transactionTime: "100",
            tokenAmount: 10, // 完全清仓
            quoteAmount: 15, // 10 * 1.5 = 15
        },
        // 清仓Token2（亏损）- 卖出价格 1 SOL < 买入价格 2 SOL
        {
            userAddress: "0xComplexUser",
            poolAddress: "0x1234567890",
            txHash: "0xClearTx2",
            isBuy: false,
            blockHeight: 100,
            tokenSymbol: "TOKEN2",
            tokenAddress: "0xToken2",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 1,
            usdPrice: 160,
            usdAmount: 800, // 5 * 160 = 800
            transactionTime: "100",
            tokenAmount: 5, // 完全清仓
            quoteAmount: 5, // 5 * 1 = 5
        }
    ];

    // 期望结果：两种代币都应该被清仓，记录1次盈利和1次亏损
    const expectedComplexResult: SnapShotForWalletTrading[] = [
        {
            walletAddress: "0xComplexUser",
            snapshotTime: "100",
            perTLTradingValue: [
                {
                    tokenAddress: "0xToken1",
                    tradeAmount: 10,
                    tokenPrice: 1.5,
                    tokenUsdPrice: 240,
                    tradeSolAmount: 15,
                    tradeUsdAmount: 2400,
                    isBuy: false,
                },
                {
                    tokenAddress: "0xToken2",
                    tradeAmount: 5,
                    tokenPrice: 1,
                    tokenUsdPrice: 160,
                    tradeSolAmount: 5,
                    tradeUsdAmount: 800,
                    isBuy: false,
                }
            ],
            totalBuySolAmount: 15,
            totalBuyUsdAmount: 2400,
            totalSellSolAmount: 20, // 15 + 5
            totalSellUsdAmount: 3200, // 2400 + 800
            buy_count: 3,
            sell_count: 2,
            solPrice: 160,
            winCount: 1, // Token1 盈利
            loseCount: 1, // Token2 亏损
            currentTokenValue: [  // 现在保留代币记录，标记为已清仓
                {
                    tokenAddress: "0xToken1",
                    tokenBalance: 0,
                    tokenSolPrice: 1.5,
                    tokenUsdPrice: 240,
                    tokenWeightBuyPrice: 0.5,
                    tokenWeightBuyUsdPrice: 80,
                    tokenWeightSellPrice: 1.5,
                    tokenWeightSellUsdPrice: 240,
                    totalBuyAmount: 10,
                    totalSellAmount: 10,
                    transactions: 3,
                    isCleared: true,
                    clearanceHistory: [{
                        clearanceTime: "100",
                        totalBuyAmount: 10,
                        totalSellAmount: 10,
                        avgBuyPrice: 0.5,
                        avgBuyUsdPrice: 80,
                        avgSellPrice: 1.5,
                        avgSellUsdPrice: 240,
                        transactions: 3,
                        isProfit: true,
                        pnlSol: 10, // (1.5 - 0.5) * 10 = 10 SOL
                        pnlUsd: 1600 // (240 - 80) * 10 = 1600 USD
                    }]
                },
                {
                    tokenAddress: "0xToken2",
                    tokenBalance: 0,
                    tokenSolPrice: 1,
                    tokenUsdPrice: 160,
                    tokenWeightBuyPrice: 2,
                    tokenWeightBuyUsdPrice: 320,
                    tokenWeightSellPrice: 1,
                    tokenWeightSellUsdPrice: 160,
                    totalBuyAmount: 5,
                    totalSellAmount: 5,
                    transactions: 2,
                    isCleared: true,
                    clearanceHistory: [{
                        clearanceTime: "100",
                        totalBuyAmount: 5,
                        totalSellAmount: 5,
                        avgBuyPrice: 2,
                        avgBuyUsdPrice: 320,
                        avgSellPrice: 1,
                        avgSellUsdPrice: 160,
                        transactions: 2,
                        isProfit: false,
                        pnlSol: -5, // (1 - 2) * 5 = -5 SOL
                        pnlUsd: -800 // (160 - 320) * 5 = -800 USD
                    }]
                }
            ],
        }
    ];

    const complexStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(mockComplexHistoryData[0])
    );

    try {
        const result = await snapshotWalletTradingByTxData(mockComplexClearanceData);
        console.log("复杂清仓测试结果:", JSON.stringify(result, null, 2));
        expect(result).toEqual(expectedComplexResult);
    } finally {
        complexStub.restore();
    }
});

Deno.test("snapshotWalletTradingByTxData - 新清仓逻辑测试", async () => {
    // 模拟用户交易数据：买入后卖出超过买入量
    const mockClearingData: TokenSwapFilterData[] = [
        // 买入100个TOKEN
        {
            userAddress: "0xClearUser",
            poolAddress: "0x1234567890",
            txHash: "0xBuyTx",
            isBuy: true,
            blockHeight: 100,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.01,
            usdPrice: 1.5,
            usdAmount: 150,
            transactionTime: "99",
            tokenAmount: 100,
            quoteAmount: 1,
        },
        // 卖出120个TOKEN（超过买入量）
        {
            userAddress: "0xClearUser",
            poolAddress: "0x1234567890",
            txHash: "0xSellTx",
            isBuy: false,
            blockHeight: 100,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.015,
            usdPrice: 2.25,
            usdAmount: 270,
            transactionTime: "100",
            tokenAmount: 120,
            quoteAmount: 1.8,
        }
    ];

    const result = await snapshotWalletTradingByTxData(mockClearingData);

    // 验证基本结果
    assertEquals(result.length, 1);
    const userSnapshot = result[0];

    // 验证用户数据
    assertEquals(userSnapshot.walletAddress, "0xClearUser");
    assertEquals(userSnapshot.buy_count, 1);
    assertEquals(userSnapshot.sell_count, 1);

    // 验证currentTokenValue仍然包含代币记录
    assertEquals(userSnapshot.currentTokenValue.length, 1);
    const tokenValue = userSnapshot.currentTokenValue[0];

    // 验证代币数据
    assertEquals(tokenValue.tokenAddress, "0xToken1");
    assertEquals(tokenValue.totalBuyAmount, 100);
    assertEquals(tokenValue.totalSellAmount, 120);
    assertEquals(tokenValue.transactions, 2);

    // 关键验证：tokenBalance应该为0（因为卖出量超过买入量）
    assertEquals(tokenValue.tokenBalance, 0);

    // 验证清仓状态（因为卖出比例超过99%，应该被标记为已清仓）
    assertEquals(tokenValue.isCleared, true);

    // 验证盈亏计算（盈利：买入价格0.01 SOL，卖出价格0.015 SOL）
    assertEquals(userSnapshot.winCount, 1);
    assertEquals(userSnapshot.loseCount, 0);

    console.log("✅ 新清仓逻辑测试通过：保留代币记录，tokenBalance设为0，正确标记清仓状态");
});

Deno.test("snapshotWalletTradingByTxData - 卖出超过买入但未清仓测试", async () => {
    // 模拟用户买入100个，卖出110个（超过买入但比例为110%，超过但不到清仓标准）
    const mockOverSellData: TokenSwapFilterData[] = [
        // 买入100个TOKEN
        {
            userAddress: "0xOverSellUser",
            poolAddress: "0x1234567890",
            txHash: "0xBuyTx",
            isBuy: true,
            blockHeight: 100,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.01,
            usdPrice: 1.5,
            usdAmount: 150,
            transactionTime: "99",
            tokenAmount: 100,
            quoteAmount: 1,
        },
        // 卖出105个TOKEN（比例105%，超过但不到99%清仓标准）
        {
            userAddress: "0xOverSellUser",
            poolAddress: "0x1234567890",
            txHash: "0xSellTx",
            isBuy: false,
            blockHeight: 100,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.015,
            usdPrice: 2.25,
            usdAmount: 236.25,
            transactionTime: "100",
            tokenAmount: 105,
            quoteAmount: 1.575,
        }
    ];

    const result = await snapshotWalletTradingByTxData(mockOverSellData);

    // 验证基本结果
    assertEquals(result.length, 1);
    const userSnapshot = result[0];
    const tokenValue = userSnapshot.currentTokenValue[0];

    // 关键验证：tokenBalance应该为0（卖出量超过买入量）
    assertEquals(tokenValue.tokenBalance, 0);

    // 但不应该被标记为已清仓（因为比例105%超过了99%）
    assertEquals(tokenValue.isCleared, true); // 实际上105% > 99%，所以仍然会被标记为清仓

    console.log("✅ 卖出超过买入测试通过：tokenBalance设为0");
});

Deno.test("getLatestWalletTradingSnapshotBeforeTime", async () => {
    const txData = Deno.readTextFileSync("./txdata.json");
    const txDataArray = JSON.parse(txData);
    const txDataFilter = SolanaBlockDataHandler.filterTokenData(txDataArray);
    const result = await snapshotWalletTradingByTxData(txDataFilter);
    console.log(result.length);
    await client.close();
});

Deno.test("清仓历史功能综合测试 - 买入清仓重新买入再清仓", async () => {
    // 模拟完整的交易周期：买入 -> 清仓 -> 重新买入 -> 再次清仓
    const mockComplexTradingData: TokenSwapFilterData[] = [
        // 第一轮：买入100个TOKEN，价格0.01 SOL
        {
            userAddress: "0xHistoryUser",
            poolAddress: "0x1234567890",
            txHash: "0xBuy1",
            isBuy: true,
            blockHeight: 100,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.01,
            usdPrice: 1.6,
            usdAmount: 160,
            transactionTime: "100",
            tokenAmount: 100,
            quoteAmount: 1,
        },
        // 第一轮：清仓100个TOKEN，价格0.02 SOL（盈利）
        {
            userAddress: "0xHistoryUser",
            poolAddress: "0x1234567890",
            txHash: "0xSell1",
            isBuy: false,
            blockHeight: 101,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.02,
            usdPrice: 3.2,
            usdAmount: 320,
            transactionTime: "101",
            tokenAmount: 100,
            quoteAmount: 2,
        },
        // 第二轮：重新买入50个TOKEN，价格0.015 SOL
        {
            userAddress: "0xHistoryUser",
            poolAddress: "0x1234567890",
            txHash: "0xBuy2",
            isBuy: true,
            blockHeight: 102,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.015,
            usdPrice: 2.4,
            usdAmount: 120,
            transactionTime: "102",
            tokenAmount: 50,
            quoteAmount: 0.75,
        },
        // 第二轮：再次清仓50个TOKEN，价格0.008 SOL（亏损）
        {
            userAddress: "0xHistoryUser",
            poolAddress: "0x1234567890",
            txHash: "0xSell2",
            isBuy: false,
            blockHeight: 103,
            tokenSymbol: "TOKEN",
            tokenAddress: "0xToken1",
            quoteSymbol: "SOL",
            quoteAddress: TOKENS.SOL,
            quotePrice: 0.008,
            usdPrice: 1.28,
            usdAmount: 64,
            transactionTime: "103",
            tokenAmount: 50,
            quoteAmount: 0.4,
        }
    ];

    // Mock 数据库调用，返回null表示没有历史数据
    const historyStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(null)
    );

    try {
        const result = await snapshotWalletTradingByTxData(mockComplexTradingData);

        // 验证基本结果
        assertEquals(result.length, 1);
        const userSnapshot = result[0];

        // 验证用户数据
        assertEquals(userSnapshot.walletAddress, "0xHistoryUser");
        assertEquals(userSnapshot.buy_count, 2);
        assertEquals(userSnapshot.sell_count, 2);
        assertEquals(userSnapshot.winCount, 1); // 第一轮盈利
        assertEquals(userSnapshot.loseCount, 1); // 第二轮亏损

        // 验证currentTokenValue仍然包含代币记录
        assertEquals(userSnapshot.currentTokenValue.length, 1);
        const tokenValue = userSnapshot.currentTokenValue[0];

        // 验证代币是已清仓状态
        assertEquals(tokenValue.isCleared, true);
        assertEquals(tokenValue.tokenBalance, 0);

        // 🔑 关键验证：清仓历史应该有两条记录
        assertEquals(tokenValue.clearanceHistory?.length, 2);

        if (tokenValue.clearanceHistory) {
            // 验证第一次清仓记录（盈利）
            const firstClearance = tokenValue.clearanceHistory[0];
            assertEquals(firstClearance.totalBuyAmount, 100);
            assertEquals(firstClearance.totalSellAmount, 100);
            assertEquals(firstClearance.avgBuyPrice, 0.01);
            assertEquals(firstClearance.avgSellPrice, 0.02);
            assertEquals(firstClearance.isProfit, true);
            assertEquals(firstClearance.pnlSol, 1); // (0.02 - 0.01) * 100 = 1 SOL

            // 验证第二次清仓记录（亏损）
            const secondClearance = tokenValue.clearanceHistory[1];
            assertEquals(secondClearance.totalBuyAmount, 50);
            assertEquals(secondClearance.totalSellAmount, 50);
            assertEquals(secondClearance.avgBuyPrice, 0.015);
            assertEquals(secondClearance.avgSellPrice, 0.008);
            assertEquals(secondClearance.isProfit, false);
            assertEquals(secondClearance.pnlSol, -0.35); // (0.008 - 0.015) * 50 = -0.35 SOL
        }

        // 验证辅助函数
        const clearanceHistory = getTokenClearanceHistory(userSnapshot, "0xToken1");
        assertEquals(clearanceHistory.length, 2);

        const totalPnL = calculateTotalClearancePnL(userSnapshot);
        assertEquals(totalPnL.totalClearances, 2);
        assertEquals(totalPnL.profitableClearances, 1);
        assertEquals(totalPnL.unprofitableClearances, 1);
        assertEquals(totalPnL.totalPnlSol, 0.65); // 1 + (-0.35) = 0.65 SOL

        const clearedTokens = getClearedTokensList(userSnapshot);
        assertEquals(clearedTokens.length, 1);
        assertEquals(clearedTokens[0].tokenAddress, "0xToken1");
        assertEquals(clearedTokens[0].clearanceCount, 2);
        assertEquals(clearedTokens[0].isCurrentlyCleared, true);

        console.log("✅ 清仓历史功能测试通过：");
        console.log(`   - 记录了 ${clearanceHistory.length} 次清仓历史`);
        console.log(`   - 总盈亏: ${totalPnL.totalPnlSol} SOL`);
        console.log(`   - 盈利次数: ${totalPnL.profitableClearances}, 亏损次数: ${totalPnL.unprofitableClearances}`);
    } finally {
        historyStub.restore();
    }
});
