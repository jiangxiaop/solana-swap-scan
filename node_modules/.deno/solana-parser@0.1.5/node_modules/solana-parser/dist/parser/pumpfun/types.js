"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = exports.TRADE_EVENT_SIG = exports.COMPLETE_EVENT_SIG = exports.CREATE_EVENT_SIG = void 0;
exports.CREATE_EVENT_SIG = 'event:CreateEvent';
exports.COMPLETE_EVENT_SIG = 'event:CompleteEvent';
exports.TRADE_EVENT_SIG = 'event:TradeEvent';
var ActionType;
(function (ActionType) {
    ActionType["CREATE"] = "create";
    ActionType["COMPLETE"] = "complete";
    ActionType["TRADE"] = "trade";
    ActionType["UNKNOWN"] = "unknown";
})(ActionType || (exports.ActionType = ActionType = {}));
//# sourceMappingURL=types.js.map