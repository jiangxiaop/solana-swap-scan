import { expect } from "jsr:@std/expect/expect";
import { Stub, stub } from "jsr:@std/testing/mock";


import { TOKENS } from "../../constant/token.ts";
import { TokenSwapFilterData } from "../../type/swap.ts";
import { SnapShotForWalletTrading } from "../../type/transaction.ts";
import { snapshotWalletTradingByTxData, walletTradingService } from "./index.ts";


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
                    transactions: 2
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
            winCount: 0,
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
                    transactions: 3
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
        () => Promise.resolve(mock_per_tw_snapshot_data)
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
            currentTokenValue: [], // 清仓后应该为空
        }
    ];

    const clearanceStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(mockHistoryData)
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
            currentTokenValue: [], // 两种代币都被清仓
        }
    ];

    const complexStub = stub(
        walletTradingService,
        "initWalletTrading",
        () => Promise.resolve(mockComplexHistoryData)
    );

    try {
        const result = await snapshotWalletTradingByTxData(mockComplexClearanceData);
        console.log("复杂清仓测试结果:", JSON.stringify(result, null, 2));
        expect(result).toEqual(expectedComplexResult);
    } finally {
        complexStub.restore();
    }
});
