import { TransactionAdapter } from '../transaction-adapter.ts';
import {
    ClassifiedInstruction,
    DexInfo,
    RaydiumLCPEvent,
    RaydiumLCPTradeEvent,
    TradeDirection,
    TradeInfo,
    TransferData,
} from '../../../type/index.ts';
import { getRaydiumTradeInfo } from './util.ts';
import { BaseParser } from '../base-parser.ts';
import { RaydiumLaunchpadEventParser } from './launchpad-event.ts';

export class RaydiumLaunchpadParser extends BaseParser {
    private eventParser: RaydiumLaunchpadEventParser;

    constructor(
        adapter: TransactionAdapter,
        dexInfo: DexInfo,
        transferActions: Record<string, TransferData[]>,
        classifiedInstructions: ClassifiedInstruction[]
    ) {
        super(adapter, dexInfo, transferActions, classifiedInstructions);
        this.eventParser = new RaydiumLaunchpadEventParser(adapter);
    }

    public processTrades(): TradeInfo[] {
        const events = this.eventParser
            .parseInstructions(this.classifiedInstructions)
            .filter((event) => event.type === 'TRADE');

        return events.map((event) => this.createTradeInfo(event));
    }

    private createTradeInfo(data: RaydiumLCPEvent): TradeInfo {
        const event = data.data as RaydiumLCPTradeEvent;
        const isBuy = event.tradeDirection == TradeDirection.Buy;
        const [inputToken, inputDecimal, outputToken, outputDecimal] = isBuy
            ? [
                event.quoteMint,
                this.adapter.splDecimalsMap.get(event.quoteMint),
                event.baseMint,
                this.adapter.splDecimalsMap.get(event.baseMint),
            ]
            : [
                event.baseMint,
                this.adapter.splDecimalsMap.get(event.baseMint),
                event.quoteMint,
                this.adapter.splDecimalsMap.get(event.quoteMint),
            ];

        if (!inputToken || !outputToken) throw new Error('Token not found');

        const trade = getRaydiumTradeInfo(
            event,
            { mint: inputToken, decimals: inputDecimal! },
            { mint: outputToken, decimals: outputDecimal! },
            {
                slot: data.slot,
                signature: data.signature,
                timestamp: data.timestamp,
                idx: data.idx,
                dexInfo: this.dexInfo,
            }
        );

        return this.utils.attachTokenTransferInfo(trade, this.transferActions);
    }
}
