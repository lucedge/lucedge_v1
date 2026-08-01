import "server-only";
import path from "node:path";
import tls from "node:tls";
import protobuf from "protobufjs";
import type { CTraderAccountSummary } from "./types";

const LIVE_HOST = "live.ctraderapi.com";
const DEMO_HOST = "demo.ctraderapi.com";
const PORT = 5035;
const REQUEST_TIMEOUT_MS = 15_000;

const PAYLOAD_TYPE = {
  APPLICATION_AUTH_REQ: 2100,
  APPLICATION_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102,
  ACCOUNT_AUTH_RES: 2103,
  DEAL_LIST_REQ: 2133,
  DEAL_LIST_RES: 2134,
  ERROR_RES: 2142,
  SYMBOLS_LIST_REQ: 2114,
  SYMBOLS_LIST_RES: 2115,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ: 2149,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_RES: 2150,
} as const;

let rootPromise: Promise<protobuf.Root> | null = null;
function getRoot(): Promise<protobuf.Root> {
  if (!rootPromise) {
    rootPromise = protobuf.load(path.join(process.cwd(), "lib/broker/ctrader/proto/openapi.proto"));
  }
  return rootPromise;
}

/**
 * Thin wrapper around one short-lived TLS socket to a cTrader Open API host.
 * Opened, used for a small sequence of request/response calls, then closed —
 * we never hold a connection open between separate serverless invocations,
 * so no heartbeat is needed (heartbeats only matter for long-lived idle
 * connections).
 */
class ProtoSocket {
  private socket: tls.TLSSocket;
  private root: protobuf.Root;
  private buffer: Buffer = Buffer.alloc(0);
  private pending: { resolve: (msg: { payloadType: number; payload: Buffer }) => void; reject: (err: Error) => void }[] = [];

  private constructor(socket: tls.TLSSocket, root: protobuf.Root) {
    this.socket = socket;
    this.root = root;
    this.socket.on("data", (chunk: Buffer) => this.onData(chunk));
    this.socket.on("error", (err) => this.failAll(err));
    this.socket.on("close", () => this.failAll(new Error("cTrader connection closed unexpectedly")));
  }

  static async connect(host: string): Promise<ProtoSocket> {
    const root = await getRoot();
    const socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const s = tls.connect({ host, port: PORT }, () => resolve(s));
      s.once("error", reject);
    });
    return new ProtoSocket(socket, root);
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 4) return;
      const length = this.buffer.readUInt32BE(0);
      if (this.buffer.length < 4 + length) return;
      const frame = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);

      const ProtoMessage = this.root.lookupType("ctrader.ProtoMessage");
      const decoded = ProtoMessage.toObject(ProtoMessage.decode(frame), { defaults: true }) as {
        payloadType: number;
        payload?: Buffer;
      };
      const waiter = this.pending.shift();
      waiter?.resolve({ payloadType: decoded.payloadType, payload: decoded.payload ?? Buffer.alloc(0) });
    }
  }

  private failAll(err: Error) {
    for (const waiter of this.pending.splice(0)) waiter.reject(err);
  }

  async sendCommand<T extends Record<string, unknown>>(
    messageTypeName: string,
    payloadType: number,
    body: T,
  ): Promise<{ payloadType: number; payload: Buffer }> {
    const MessageType = this.root.lookupType(`ctrader.${messageTypeName}`);
    const message = MessageType.create(body);
    const payloadBytes = MessageType.encode(message).finish();

    const ProtoMessage = this.root.lookupType("ctrader.ProtoMessage");
    const envelope = ProtoMessage.encode(
      ProtoMessage.create({ payloadType, payload: payloadBytes }),
    ).finish();

    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(envelope.length, 0);

    const responsePromise = new Promise<{ payloadType: number; payload: Buffer }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cTrader request timed out")), REQUEST_TIMEOUT_MS);
      this.pending.push({
        resolve: (msg) => { clearTimeout(timer); resolve(msg); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
    });

    this.socket.write(Buffer.concat([lengthPrefix, Buffer.from(envelope)]));
    return responsePromise;
  }

  decode<T>(messageTypeName: string, payload: Buffer): T {
    const MessageType = this.root.lookupType(`ctrader.${messageTypeName}`);
    return MessageType.toObject(MessageType.decode(payload), { defaults: true, longs: String }) as T;
  }

  close() {
    this.socket.destroy();
  }
}

function assertNotError(response: { payloadType: number; payload: Buffer }, socket: ProtoSocket) {
  if (response.payloadType === PAYLOAD_TYPE.ERROR_RES) {
    const err = socket.decode<{ errorCode: string; description?: string }>("ProtoErrorRes", response.payload);
    throw new Error(`cTrader error ${err.errorCode}: ${err.description ?? ""}`.trim());
  }
}

async function authenticateApp(socket: ProtoSocket): Promise<void> {
  const clientId = process.env.CTRADER_CLIENT_ID;
  const clientSecret = process.env.CTRADER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("CTRADER_CLIENT_ID/CTRADER_CLIENT_SECRET not set");

  const res = await socket.sendCommand("ProtoOAApplicationAuthReq", PAYLOAD_TYPE.APPLICATION_AUTH_REQ, {
    clientId,
    clientSecret,
  });
  assertNotError(res, socket);
}

async function listAccountsOnHost(host: string, accessToken: string): Promise<CTraderAccountSummary[]> {
  const socket = await ProtoSocket.connect(host);
  try {
    await authenticateApp(socket);
    const res = await socket.sendCommand(
      "ProtoOAGetAccountListByAccessTokenReq",
      PAYLOAD_TYPE.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
      { accessToken },
    );
    assertNotError(res, socket);
    const decoded = socket.decode<{ ctidTraderAccount: { ctidTraderAccountId: string; isLive?: boolean; traderLogin?: string }[] }>(
      "ProtoOAGetAccountListByAccessTokenRes",
      res.payload,
    );
    return (decoded.ctidTraderAccount ?? []).map((a) => ({
      ctidTraderAccountId: String(a.ctidTraderAccountId),
      isLive: a.isLive ?? false,
      traderLogin: a.traderLogin != null ? String(a.traderLogin) : "",
    }));
  } finally {
    socket.close();
  }
}

/**
 * Fetches the trader's accounts under this access token. Whether a single
 * host returns only same-type accounts or every account regardless of host
 * isn't confirmed from cTrader's docs — querying both and de-duplicating by
 * ctidTraderAccountId is correct either way, at the cost of one extra socket
 * round trip.
 */
export async function listAccounts(accessToken: string): Promise<CTraderAccountSummary[]> {
  const results = await Promise.allSettled([
    listAccountsOnHost(LIVE_HOST, accessToken),
    listAccountsOnHost(DEMO_HOST, accessToken),
  ]);

  const byId = new Map<string, CTraderAccountSummary>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const account of result.value) byId.set(account.ctidTraderAccountId, account);
  }
  if (byId.size === 0) {
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (firstError) throw firstError.reason;
  }
  return [...byId.values()];
}

export type RawCTraderDeal = {
  dealId: string;
  positionId: string;
  symbolId: string;
  volume: string;
  filledVolume: string;
  executionTimestamp: string;
  tradeSide: number; // 1 = BUY, 2 = SELL
  dealStatus: number;
  executionPrice?: number;
  commission?: string;
  closePositionDetail?: {
    entryPrice: number;
    grossProfit: string;
    swap: string;
    commission: string;
  };
};

export async function fetchDeals(params: {
  ctidTraderAccountId: string;
  isLive: boolean;
  accessToken: string;
  fromTimestamp: number;
  toTimestamp: number;
  maxRows?: number;
}): Promise<{ deals: RawCTraderDeal[]; hasMore: boolean; symbolNames: Map<string, string> }> {
  const host = params.isLive ? LIVE_HOST : DEMO_HOST;
  const socket = await ProtoSocket.connect(host);
  try {
    await authenticateApp(socket);

    const authRes = await socket.sendCommand("ProtoOAAccountAuthReq", PAYLOAD_TYPE.ACCOUNT_AUTH_REQ, {
      ctidTraderAccountId: params.ctidTraderAccountId,
      accessToken: params.accessToken,
    });
    assertNotError(authRes, socket);

    // Symbol names aren't included on a deal itself (only a numeric
    // symbolId), so resolve them in the same authenticated session — one
    // extra round trip per sync tick, cheap compared to opening a second
    // connection.
    const symbolsRes = await socket.sendCommand("ProtoOASymbolsListReq", PAYLOAD_TYPE.SYMBOLS_LIST_REQ, {
      ctidTraderAccountId: params.ctidTraderAccountId,
    });
    assertNotError(symbolsRes, socket);
    const symbolsDecoded = socket.decode<{ symbol: { symbolId: string; symbolName?: string }[] }>(
      "ProtoOASymbolsListRes",
      symbolsRes.payload,
    );
    const symbolNames = new Map<string, string>(
      (symbolsDecoded.symbol ?? []).map((s) => [String(s.symbolId), s.symbolName ?? String(s.symbolId)]),
    );

    const dealRes = await socket.sendCommand("ProtoOADealListReq", PAYLOAD_TYPE.DEAL_LIST_REQ, {
      ctidTraderAccountId: params.ctidTraderAccountId,
      fromTimestamp: params.fromTimestamp,
      toTimestamp: params.toTimestamp,
      maxRows: params.maxRows ?? 1000,
    });
    assertNotError(dealRes, socket);

    const decoded = socket.decode<{ deal: RawCTraderDeal[]; hasMore: boolean }>(
      "ProtoOADealListRes",
      dealRes.payload,
    );
    return { deals: decoded.deal ?? [], hasMore: decoded.hasMore ?? false, symbolNames };
  } finally {
    socket.close();
  }
}
