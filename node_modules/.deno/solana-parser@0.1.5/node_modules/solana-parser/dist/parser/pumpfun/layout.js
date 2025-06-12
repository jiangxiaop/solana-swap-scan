"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLETE_EVENT_LAYOUT = exports.TRADE_EVENT_LAYOUT = exports.CREATE_EVENT_LAYOUT = void 0;
const buffer_layout_1 = require("@solana/buffer-layout");
const layout_1 = require("../../core/layout");
exports.CREATE_EVENT_LAYOUT = (0, buffer_layout_1.struct)([
    (0, layout_1.stringLayout)('name'),
    (0, layout_1.stringLayout)('symbol'),
    (0, layout_1.stringLayout)('uri'),
    (0, layout_1.pubKey)('mint'),
    (0, layout_1.pubKey)('bondingCurve'),
    (0, layout_1.pubKey)('user'),
]);
exports.TRADE_EVENT_LAYOUT = (0, buffer_layout_1.struct)([
    (0, layout_1.pubKey)('mint'),
    (0, layout_1.uint64)('solAmount'),
    (0, layout_1.uint64)('tokenAmount'),
    (0, layout_1.boolean)('isBuy'),
    (0, layout_1.pubKey)('user'),
    (0, layout_1.uint64)('timestamp'),
    (0, layout_1.uint64)('virtualSolReserves'),
    (0, layout_1.uint64)('virtualTokenReserves'),
]);
exports.COMPLETE_EVENT_LAYOUT = (0, buffer_layout_1.struct)([
    (0, layout_1.pubKey)('user'),
    (0, layout_1.pubKey)('mint'),
    (0, layout_1.pubKey)('bondingCurve'),
    (0, layout_1.uint64)('timestamp'),
]);
//# sourceMappingURL=layout.js.map