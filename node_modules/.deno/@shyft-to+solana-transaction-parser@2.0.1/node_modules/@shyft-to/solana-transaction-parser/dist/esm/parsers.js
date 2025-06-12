import { Buffer } from "buffer";
import { PublicKey, SystemProgram, StakeProgram, Transaction, } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { decodeSystemInstruction, decodeTokenInstruction, decodeToken2022Instruction, decodeAssociatedTokenInstruction, decodeComputeBudgetInstruction, } from "./decoders";
import { compiledInstructionToInstruction, flattenParsedTransaction, flattenTransactionResponse, parsedInstructionToInstruction, parseTransactionAccounts, } from "./helpers";
import { decodeStakeInstruction } from "./decoders/stake";
import { convertLegacyIdlToV30 } from "./legacy.idl.converter";
const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111");
const MEMO_PROGRAM_V1 = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";
const MEMO_PROGRAM_V2 = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
function flattenIdlAccounts(accounts, prefix) {
    return accounts
        .map((account) => {
        const accName = account.name;
        if ("accounts" in account) {
            const newPrefix = prefix ? `${prefix}.${accName}` : accName;
            return flattenIdlAccounts(account.accounts, newPrefix);
        }
        else {
            return {
                ...account,
                name: prefix ? `${prefix}.${accName}` : accName,
            };
        }
    })
        .flat();
}
/**
 * Class for parsing arbitrary solana transactions in various formats
 * - by txHash
 * - from raw transaction data (base64 encoded or buffer)
 * - @solana/web3.js getTransaction().message object
 * - @solana/web3.js getParsedTransaction().message or Transaction.compileMessage() object
 * - @solana/web3.js TransactionInstruction object
 */
export class SolanaParser {
    /**
     * Initializes parser object
     * `SystemProgram`, `TokenProgram` and `AssociatedTokenProgram` are supported by default
     * but may be overriden by providing custom idl/custom parser
     * @param programInfos list of objects which contains programId and corresponding idl
     * @param parsers list of pairs (programId, custom parser)
     */
    constructor(programInfos, parsers) {
        this.instructionDecoders = new Map();
        this.instructionParsers = new Map();
        const standardParsers = [
            [SystemProgram.programId.toBase58(), decodeSystemInstruction],
            [TOKEN_PROGRAM_ID.toBase58(), decodeTokenInstruction],
            [TOKEN_2022_PROGRAM_ID.toBase58(), decodeToken2022Instruction],
            [ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), decodeAssociatedTokenInstruction],
            [COMPUTE_BUDGET_PROGRAM_ID.toBase58(), decodeComputeBudgetInstruction],
            [StakeProgram.programId.toBase58(), decodeStakeInstruction],
        ];
        for (const programInfo of programInfos) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.addParserFromIdl(new PublicKey(programInfo.programId), programInfo.idl);
        }
        let result;
        if (!parsers) {
            result = new Map(standardParsers);
        }
        else {
            // first set provided parsers
            result = new Map(parsers);
            // append standart parsers if parser not exist yet
            for (const parserInfo of standardParsers) {
                if (!result.has(parserInfo[0])) {
                    result.set(...parserInfo);
                }
            }
        }
        result.forEach((parser, key) => this.instructionParsers.set(key, parser));
    }
    /**
     * Adds (or updates) parser for provided programId
     * @param programId program id to add parser for
     * @param parser parser to parse programId instructions
     */
    addParser(programId, parser) {
        this.instructionParsers.set(programId.toBase58(), parser);
    }
    /**
     * Adds (or updates) parser for provided programId
     * @param programId program id to add parser for
     * @param idl IDL that describes anchor program
     */
    addParserFromIdl(programId, idl) {
        try {
            const convertedIdl = convertLegacyIdlToV30(idl, programId.toString());
            this.instructionDecoders.set(programId, new BorshInstructionCoder(convertedIdl));
            this.instructionParsers.set(...this.buildIdlParser(new PublicKey(programId), convertedIdl));
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to build parser from IDL of programId: ", programId, ", error:", e);
        }
    }
    isParserAvailble(programId) {
        return this.instructionParsers.has(programId.toString());
    }
    retrieveParserReadyProgramIds() {
        const programIds = Array.from(this.instructionParsers.keys());
        // eslint-disable-next-line newline-before-return
        return programIds.map((key) => key.toString());
    }
    buildIdlParser(programId, idl) {
        const idlParser = (instruction) => {
            const coder = new BorshInstructionCoder(idl);
            const parsedIx = coder.decode(instruction.data);
            if (!parsedIx) {
                return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
            }
            else {
                const ix = idl.instructions.find((instr) => instr.name === parsedIx.name);
                if (!ix) {
                    return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data, parsedIx.name);
                }
                const flatIdlAccounts = flattenIdlAccounts(ix.accounts);
                const accounts = instruction.keys.map((meta, idx) => {
                    if (idx < flatIdlAccounts.length) {
                        return {
                            name: flatIdlAccounts[idx].name,
                            ...meta,
                        };
                    }
                    // "Remaining accounts" are unnamed in Anchor.
                    else {
                        return {
                            name: `Remaining ${idx - flatIdlAccounts.length}`,
                            ...meta,
                        };
                    }
                });
                return {
                    name: parsedIx.name,
                    accounts: accounts,
                    programId: instruction.programId,
                    args: parsedIx.data, // as IxArgsMap<typeof idl, typeof idl["instructions"][number]["name"]>,
                };
            }
        };
        return [programId.toBase58(), idlParser.bind(this)];
    }
    /**
     * Removes parser for provided program id
     * @param programId program id to remove parser for
     */
    removeParser(programId) {
        this.instructionParsers.delete(programId.toBase58());
    }
    buildUnknownParsedInstruction(programId, accounts, argData, name) {
        return {
            programId,
            accounts,
            args: { unknown: argData },
            name: name || "unknown",
        };
    }
    /**
     * Parses instruction
     * @param instruction transaction instruction to parse
     * @returns parsed transaction instruction or UnknownInstruction
     */
    parseInstruction(instruction) {
        if (!this.instructionParsers.has(instruction.programId.toBase58())) {
            return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
        }
        else {
            try {
                const parser = this.instructionParsers.get(instruction.programId.toBase58());
                const decoder = this.instructionDecoders.get(instruction.programId.toBase58());
                return parser(instruction, decoder);
            }
            catch (error) {
                // eslint-disable-next-line no-console
                console.error("Parser does not matching the instruction args", {
                    programId: instruction.programId.toBase58(),
                    instructionData: instruction.data.toString("hex"),
                });
                return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
            }
        }
    }
    /**
     * Parses transaction data along with inner instructions
     * @param tx response to parse
     * @returns list of parsed instructions
     */
    parseTransactionWithInnerInstructions(tx) {
        const flattened = flattenTransactionResponse(tx);
        return flattened.map(({ parentProgramId, ...ix }) => {
            const parsedIx = this.parseInstruction(ix);
            if (parentProgramId) {
                parsedIx.parentProgramId = parentProgramId;
            }
            return parsedIx;
        });
    }
    /**
     * Parses transaction data
     * @param txMessage message to parse
     * @param altLoadedAddresses VersionedTransaction.meta.loaddedAddresses if tx is versioned
     * @returns list of parsed instructions
     */
    parseTransactionData(txMessage, altLoadedAddresses = undefined) {
        const parsedAccounts = parseTransactionAccounts(txMessage, altLoadedAddresses);
        return txMessage.compiledInstructions.map((instruction) => this.parseInstruction(compiledInstructionToInstruction(instruction, parsedAccounts)));
    }
    /**
     * Parses transaction data retrieved from Connection.getParsedTransaction
     * @param txParsedMessage message to parse
     * @returns list of parsed instructions
     */
    parseTransactionParsedData(txParsedMessage) {
        const parsedAccounts = txParsedMessage.accountKeys.map((metaLike) => ({
            isSigner: metaLike.signer,
            isWritable: metaLike.writable,
            pubkey: metaLike.pubkey,
        }));
        return txParsedMessage.instructions.map((parsedIx) => this.parseInstruction(parsedInstructionToInstruction(parsedIx, parsedAccounts)));
    }
    /**
     * Parses transaction data retrieved from Connection.getParsedTransaction along with the inner instructions
     * @param txParsedMessage message to parse
     * @returns list of parsed instructions
     */
    parseParsedTransactionWithInnerInstructions(txn) {
        const allInstructions = flattenParsedTransaction(txn);
        const parsedAccounts = txn.transaction.message.accountKeys.map((metaLike) => ({
            isSigner: metaLike.signer,
            isWritable: metaLike.writable,
            pubkey: metaLike.pubkey,
        }));
        return allInstructions.map(({ parentProgramId, ...instruction }) => {
            let parsedIns;
            if ("data" in instruction) {
                parsedIns = this.parseInstruction(parsedInstructionToInstruction(instruction, parsedAccounts));
            }
            else {
                parsedIns = this.convertSolanaParsedInstruction(instruction);
            }
            if (parentProgramId) {
                parsedIns.parentProgramId = parentProgramId;
            }
            return parsedIns;
        });
    }
    convertSolanaParsedInstruction(instruction) {
        const parsed = instruction.parsed;
        const pId = instruction.programId.toBase58();
        if (pId === MEMO_PROGRAM_V2 || pId === MEMO_PROGRAM_V1) {
            return {
                name: "Memo",
                programId: instruction.programId,
                args: { message: parsed },
                accounts: [],
            };
        }
        return {
            name: parsed.type,
            programId: instruction.programId,
            args: parsed.info,
            accounts: [],
        };
    }
    /**
     * Fetches tx from blockchain and parses it
     * @param connection web3 Connection
     * @param txId transaction id
     * @param flatten - true if CPI calls need to be parsed too
     * @returns list of parsed instructions
     */
    async parseTransaction(connection, txId, flatten = false, commitment = "confirmed") {
        const transaction = await connection.getTransaction(txId, { commitment: commitment, maxSupportedTransactionVersion: 0 });
        if (!transaction)
            return null;
        if (flatten) {
            const flattened = flattenTransactionResponse(transaction);
            return flattened.map((ix) => this.parseInstruction(ix));
        }
        return this.parseTransactionData(transaction.transaction.message, transaction.meta?.loadedAddresses);
    }
    /**
     * Parses transaction dump
     * @param txDump base64-encoded string or raw Buffer which contains tx dump
     * @returns list of parsed instructions
     */
    parseTransactionDump(txDump) {
        if (!(txDump instanceof Buffer))
            txDump = Buffer.from(txDump, "base64");
        const tx = Transaction.from(txDump);
        const message = tx.compileMessage();
        return this.parseTransactionData(message);
    }
}
//# sourceMappingURL=parsers.js.map