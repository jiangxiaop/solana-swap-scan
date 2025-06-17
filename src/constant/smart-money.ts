import { SmartMoneyType } from "../type/smart-money.ts";

export const SMART_MONEY_DATA_PARSE_BECH_MARK = {
    [SmartMoneyType.HIGH_WINRATE]: {
        native_token_balance: 0.5,
        wallet_balance: 1,
        profit: 0.025,
        effective_win_token_pct: 0.6,
        token_buy_counts: 0.3,
        active_days: 0.3,
    },
    [SmartMoneyType.HIGH_PROFIT]: {
        profit: 0.7,
        effective_win_token_pct: 0.5,
        native_token_balance: 0.5,
        wallet_balance: 1,
        token_buy_counts: 0.1,
        active_days: 0.3,
    },
    [SmartMoneyType.WHALE_MID_PROFIT]: {
        native_token_balance: 1000,
        wallet_balance: 2000,
        effective_win_token_pct: 0.3,
        token_buy_counts: 0.1,
        active_days: 0.3,
    }
}


// 时间窗口天数
export const SM_TWL = 30