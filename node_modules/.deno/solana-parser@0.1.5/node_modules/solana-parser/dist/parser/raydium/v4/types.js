"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionType = exports.SWAP_BASE_OUT_LOG_TYPE = exports.SWAP_BASE_IN_LOG_TYPE = exports.WITHDRAW_LOG_TYPE = exports.DEPOSIT_LOG_TYPE = exports.INIT_LOG_TYPE = exports.RayV4Program = void 0;
const web3_js_1 = require("@solana/web3.js");
exports.RayV4Program = new web3_js_1.PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
exports.INIT_LOG_TYPE = 0;
exports.DEPOSIT_LOG_TYPE = 1;
exports.WITHDRAW_LOG_TYPE = 2;
exports.SWAP_BASE_IN_LOG_TYPE = 3;
exports.SWAP_BASE_OUT_LOG_TYPE = 4;
var ActionType;
(function (ActionType) {
    ActionType["CREATE"] = "create";
    ActionType["ADD"] = "add";
    ActionType["REMOVE"] = "remove";
    ActionType["SWAP"] = "swap";
})(ActionType || (exports.ActionType = ActionType = {}));
//# sourceMappingURL=types.js.map