import crypto from "node:crypto";
import type { RawCTraderDeal } from "./protoClient";

export function computeDedupHash(connectionId: string, brokerTradeId: string): string {
  return crypto.createHash("sha256").update(`${connectionId}:${brokerTradeId}`).digest("hex");
}

export type RawTradeInsert = {
  connection_id: string;
  broker_trade_id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  open_time: string;
  close_time: string;
  open_price: number;
  close_price: number;
  fees: number;
  swap: number;
  source: "ctrader";
  dedup_hash: string;
  raw_payload: RawCTraderDeal;
};

/**
 * Maps a batch of cTrader deals to RawTrade rows.
 *
 * Deliberately batch-oriented, not per-deal: a cTrader Deal only carries a
 * timestamp for itself, not the original position-open time. To get a real
 * open_time for a closing deal, this groups deals by positionId and uses
 * the earliest deal in that group as the "opening" reference. This is an
 * assumption that needs checking against a real account with partial
 * closes/multiple fills before trusting it broadly — see the plan's open
 * question on this.
 *
 * Only closing deals (populated closePositionDetail) become a RawTrade —
 * an opening fill with no close yet isn't a completed trade to journal.
 *
 * Volume is stored as cTrader reports it (a scaled integer, e.g. hundredths
 * of a unit) without converting to lots — the exact scaling convention
 * isn't confirmed from the docs and needs validating against real deal data.
 */
export function mapDealsToRawTrades(
  deals: RawCTraderDeal[],
  connectionId: string,
  symbolNames: Map<string, string>,
): RawTradeInsert[] {
  const byPosition = new Map<string, RawCTraderDeal[]>();
  for (const deal of deals) {
    const list = byPosition.get(deal.positionId) ?? [];
    list.push(deal);
    byPosition.set(deal.positionId, list);
  }

  const trades: RawTradeInsert[] = [];
  for (const positionDeals of byPosition.values()) {
    const sorted = [...positionDeals].sort((a, b) => Number(a.executionTimestamp) - Number(b.executionTimestamp));
    const openingDeal = sorted[0];

    for (const deal of sorted) {
      if (!deal.closePositionDetail) continue;

      const symbol = symbolNames.get(deal.symbolId) ?? deal.symbolId;
      const side: "buy" | "sell" = deal.tradeSide === 1 ? "buy" : "sell";

      trades.push({
        connection_id: connectionId,
        broker_trade_id: deal.dealId,
        symbol,
        side,
        volume: Number(deal.filledVolume),
        open_time: new Date(Number(openingDeal.executionTimestamp)).toISOString(),
        close_time: new Date(Number(deal.executionTimestamp)).toISOString(),
        open_price: deal.closePositionDetail.entryPrice,
        close_price: deal.executionPrice ?? deal.closePositionDetail.entryPrice,
        fees: Number(deal.closePositionDetail.commission ?? 0) / 100,
        swap: Number(deal.closePositionDetail.swap ?? 0) / 100,
        source: "ctrader",
        dedup_hash: computeDedupHash(connectionId, deal.dealId),
        raw_payload: deal,
      });
    }
  }
  return trades;
}
