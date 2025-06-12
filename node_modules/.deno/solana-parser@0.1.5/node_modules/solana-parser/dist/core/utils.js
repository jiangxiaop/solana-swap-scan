"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSOLTransfers = exports.getSplTransfers = exports.getAccountSOLBalanceChange = exports.flattenTransactionInstructions = exports.createAnchorSigHash = exports.anchorLogScanner = void 0;
const sha256_1 = require("@noble/hashes/sha256");
const anchorLogScanner = (logs, programId) => {
    const executionStack = [];
    const programEvents = {};
    for (const log of logs) {
        if (log.includes('invoke')) {
            const program = log.split(' ')[1];
            executionStack.push(program);
            if (programEvents[program] == undefined) {
                programEvents[program] = [];
            }
        }
        else {
            const currentProgram = executionStack[executionStack.length - 1];
            if (log.match(/^Program (.*) success/g) !== null) {
                executionStack.pop();
                continue;
            }
            if (currentProgram == programId) {
                if (log.startsWith('Program data: ')) {
                    const data = log.split('Program data: ')[1];
                    programEvents[currentProgram].push(data);
                }
                continue;
            }
        }
    }
    return programEvents[programId];
};
exports.anchorLogScanner = anchorLogScanner;
const createAnchorSigHash = (sig) => {
    return Buffer.from((0, sha256_1.sha256)(sig).slice(0, 8));
};
exports.createAnchorSigHash = createAnchorSigHash;
const flattenTransactionInstructions = (transaction) => {
    // Takes a parsed transaction and creates a sorted array of all the instructions (including cpi calls)
    let txnIxs = transaction.transaction.message.instructions;
    let cpiIxs = transaction.meta?.innerInstructions?.sort((a, b) => a.index - b.index) || [];
    const totalCalls = cpiIxs.reduce((acc, ix) => acc + ix.instructions.length, 0) + txnIxs.length;
    const flattended = [];
    let lastPushedIx = -1;
    let currCallIndex = -1;
    for (const cpiIx of cpiIxs) {
        while (lastPushedIx != cpiIx.index) {
            lastPushedIx += 1;
            currCallIndex += 1;
            flattended.push(txnIxs[lastPushedIx]);
        }
        for (const innerIx of cpiIx.instructions) {
            flattended.push(innerIx);
            currCallIndex += 1;
        }
    }
    while (currCallIndex < totalCalls - 1) {
        lastPushedIx += 1;
        currCallIndex += 1;
        flattended.push(txnIxs[lastPushedIx]);
    }
    return flattended;
};
exports.flattenTransactionInstructions = flattenTransactionInstructions;
const getAccountSOLBalanceChange = (transaction, account) => {
    const accountIndex = transaction.transaction.message.accountKeys.findIndex((acct) => acct.pubkey.toString() == account.toString());
    if (accountIndex == -1)
        return 0;
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    return Math.abs(postBalances[accountIndex] - preBalances[accountIndex]);
};
exports.getAccountSOLBalanceChange = getAccountSOLBalanceChange;
const getSplTransfers = (instructions) => {
    return instructions.filter((ix) => ix.programId.toString() == 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' &&
        // @ts-ignore
        ix.parsed.type == 'transfer');
};
exports.getSplTransfers = getSplTransfers;
const getSOLTransfers = (instructions) => {
    return instructions.filter((ix) => ix.programId.toString() == '11111111111111111111111111111111' &&
        // @ts-ignore
        ix.parsed.type == 'transfer');
};
exports.getSOLTransfers = getSOLTransfers;
//# sourceMappingURL=utils.js.map