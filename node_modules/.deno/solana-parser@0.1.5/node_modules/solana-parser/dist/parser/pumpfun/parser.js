"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumpFunParser = void 0;
const web3_js_1 = require("@solana/web3.js");
const types_1 = require("./types");
const utils_1 = require("../../core/utils");
const utils_2 = require("../../core/utils");
const layout_1 = require("./layout");
class PumpFunParser {
    constructor() {
        this.discriminators = {
            create: (0, utils_1.createAnchorSigHash)(types_1.CREATE_EVENT_SIG),
            trade: (0, utils_1.createAnchorSigHash)(types_1.TRADE_EVENT_SIG),
            complete: (0, utils_1.createAnchorSigHash)(types_1.COMPLETE_EVENT_SIG),
        };
        this.PROGRAM_ID = new web3_js_1.PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    }
    decodeEvent(event) {
        const discriminator = Buffer.from(event, 'base64').slice(0, 8);
        const remainder = Buffer.from(event, 'base64').slice(8);
        if (discriminator.equals(this.discriminators.create)) {
            const createEvent = layout_1.CREATE_EVENT_LAYOUT.decode(remainder);
            return {
                type: types_1.ActionType.CREATE,
                info: {
                    name: createEvent.name,
                    symbol: createEvent.symbol,
                    uri: createEvent.uri,
                    tokenMint: createEvent.mint,
                    createdBy: createEvent.user,
                    bondingCurve: createEvent.bondingCurve,
                    tokenDecimals: 6,
                },
            };
        }
        if (discriminator.equals(this.discriminators.trade)) {
            const tradeEvent = layout_1.TRADE_EVENT_LAYOUT.decode(remainder);
            return {
                type: types_1.ActionType.TRADE,
                info: {
                    solAmount: tradeEvent.solAmount,
                    tokenAmount: tradeEvent.tokenAmount,
                    tokenMint: tradeEvent.mint,
                    trader: tradeEvent.user,
                    isBuy: tradeEvent.isBuy,
                    timestamp: tradeEvent.timestamp,
                    virtualSolReserves: tradeEvent.virtualSolReserves,
                    virtualTokenReserves: tradeEvent.virtualTokenReserves,
                },
            };
        }
        if (discriminator.equals(this.discriminators.complete)) {
            const completeEvent = layout_1.COMPLETE_EVENT_LAYOUT.decode(remainder);
            return {
                type: types_1.ActionType.COMPLETE,
                info: {
                    user: completeEvent.user,
                    tokenMint: completeEvent.mint,
                    bondingCurve: completeEvent.bondingCurve,
                    timestamp: completeEvent.timestamp,
                },
            };
        }
        return {
            type: types_1.ActionType.UNKNOWN,
            info: {},
        };
    }
    parse(transaction) {
        const transactionResult = {
            actions: [],
            platform: 'pumpfun',
        };
        const events = (0, utils_2.anchorLogScanner)(transaction.meta?.logMessages ?? [], this.PROGRAM_ID.toBase58());
        const actions = events.map((event) => this.decodeEvent(event));
        transactionResult.actions = actions;
        return transactionResult;
    }
    parseMultiple(transactions) {
        return transactions.map((txn) => this.parse(txn));
    }
}
exports.PumpFunParser = PumpFunParser;
//# sourceMappingURL=parser.js.map