import { ConfirmedSignatureInfo, ParsedTransactionWithMeta, PublicKey, SignaturesForAddressOptions } from "@solana/web3.js";
import solana_connect_instance from "../lib/solana.ts";
import { Protocol } from "../type/enum.ts";
import { SOLANA_DEX_OFFICIAL_ADDRESS } from "../constant/config.ts";
import { parseRaydiumTransaction } from "./transactions/raydium.ts";


const concurrentLimit = 20;



export async function collectProtocolTransactions(protocol: Protocol) {

  const programId = SOLANA_DEX_OFFICIAL_ADDRESS[protocol];
  // 将字符串转换为PublicKey
  const programPubkey = new PublicKey(programId);


  const batchSize = 100;

  const startBlockNumber = 176400000;
  const endBlockNumber = 176400020;

  const connection = solana_connect_instance.getConnection();


  console.log(`采集 ${protocol} 从 ${startBlockNumber} 到 ${endBlockNumber} 的交易`);

  // 使用GetSignaturesForAddress API获取程序的交易签名
  let signatures: ConfirmedSignatureInfo[] = [];
  let lastSignature = "";

  // 分批获取交易签名
  while (true) {
    try {

      let options: SignaturesForAddressOptions = {
        limit: batchSize,
      };
      if (lastSignature) {
        options = {
          before: lastSignature,
          limit: batchSize,
        };
      }

      

      const sigs = await connection.getSignaturesForAddress(programPubkey, options);
      if (sigs.length === 0) break;

      // 过滤时间范围内的交易
      const filteredSigs = sigs.filter(sig => {
        const blockTime = sig.blockTime;
        return blockTime && blockTime >= startUnixTime && blockTime <= endUnixTime;
      });
      // 如果没有在时间范围内的交易，且最后一个交易早于开始时间，则退出

      console.log("got filteredSigs", filteredSigs.length);

      if (filteredSigs.length === 0 && sigs[sigs.length - 1] && typeof sigs[sigs.length - 1].blockTime === 'number' && (sigs[sigs.length - 1] as any).blockTime < startUnixTime) {
        break;
      }


      // 使用类型断言确保类型安全
      signatures = [...signatures, ...filteredSigs] as typeof signatures;
      lastSignature = sigs[sigs.length - 1]?.signature;

      console.log(`已获取 ${signatures.length} 个 ${protocol} 交易签名`);
    } catch (error) {
      console.error(`获取 ${protocol} 交易签名出错:`, error);
      break;
    }
  }

  console.log(`总共获取到 ${signatures.length} 个 ${protocol} 交易签名，开始处理交易...`);

  // 分批处理交易详情
  const batchCount = Math.ceil(signatures.length / batchSize);
  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, signatures.length);
    const batch = signatures.slice(start, end);

    console.log(`处理 ${protocol} 交易批次 ${i + 1}/${batchCount}, 包含 ${batch.length} 个交易`);

    // 并发处理交易详情
    await processTransactionBatch(batch, protocol);
  }
}


// 处理一批交易
async function processTransactionBatch(signatureBatch: ConfirmedSignatureInfo[], protocol: Protocol) {
  // 控制并发
  const batches: ConfirmedSignatureInfo[][] = [];
  for (let i = 0; i < signatureBatch.length; i += concurrentLimit) {
    batches.push(signatureBatch.slice(i, i + concurrentLimit));
  }

  for (const batch of batches) {
    const promises = batch.map(sig => processTransaction(sig.signature, protocol));
    await Promise.all(promises);
  }
}

// 处理单个交易
async function processTransaction(signature: string, protocol: Protocol) {
  const connection = solana_connect_instance.getConnection();
  try {
    const txInfo = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!txInfo || !txInfo.meta || txInfo.meta.err) {
      // 交易失败或不存在
      return;
    }

    // 解析交易详情
    const parsedTx = await parseTransaction(txInfo, protocol);
    if (parsedTx) {
      // 存储到数据库
      // await saveSwapEvent(parsedTx);

      console.log("save swap event parsedTx", parsedTx);
    }
  } catch (error) {
    console.error(`处理交易 ${signature} 失败:`, error);
  }
}

async function parseTransaction(txInfo: ParsedTransactionWithMeta, protocol: Protocol) {
  // 基本交易信息
  const signature = txInfo.transaction.signatures[0];
  const blockTime = txInfo.blockTime || 0;
  const slot = txInfo.slot;
  const feePayer = txInfo.transaction.message.accountKeys[0].pubkey.toString();

  // 协议特定的交易解析逻辑
  switch (protocol) {
    // case Protocol.JUPITER:
    //   return parseJupiterTransaction(txInfo, signature, blockTime, slot, feePayer);
    case Protocol.RAYDIUM:
      return parseRaydiumTransaction(txInfo, signature, blockTime, slot, feePayer);
    // case Protocol.ORCA:
    //   return parseOrcaTransaction(txInfo, signature, blockTime, slot, feePayer);
    // case Protocol.PUMPFUN:
    //   return parsePumpfunTransaction(txInfo, signature, blockTime, slot, feePayer);
    // case Protocol.METEORA:
    //   return parseMeteorTransaction(txInfo, signature, blockTime, slot, feePayer);
    default:
      return null;
  }
}


collectProtocolTransactions(Protocol.RAYDIUM);