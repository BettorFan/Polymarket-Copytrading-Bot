import { Side, OrderType, UserMarketOrder, CreateOrderOptions } from "@polymarket/clob-client";
import type { TradePayload } from "../utils/types";

export interface CopyTradeOptions {
    trade: TradePayload;
    
    sizeMultiplier?: number;
    
    maxAmount?: number;
    
    orderSizeTokens?: number;
    
    orderAmountUsdc?: number;
    
    orderType?: OrderType.FOK | OrderType.FAK;
    
    tickSize?: CreateOrderOptions["tickSize"];
    
    negRisk?: boolean;
    
    feeRateBps?: number;
}

export interface CopyTradeResult {
    success: boolean;
    
    orderID?: string;
    
    error?: string;
    
    transactionHashes?: string[];
    
    marketOrder?: UserMarketOrder;
}

