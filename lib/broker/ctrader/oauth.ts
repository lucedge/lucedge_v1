import "server-only";

const AUTHORIZE_URL = "https://id.ctrader.com/my/settings/openapi/grantingaccess/";
const TOKEN_URL = "https://openapi.ctrader.com/apps/token";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getEnv("CTRADER_CLIENT_ID"),
    redirect_uri: getEnv("CTRADER_REDIRECT_URI"),
    scope: "accounts",
    product: "web",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type CTraderTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type TokenResponse = {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
  errorCode?: string;
  error?: string;
};

function parseTokenResponse(data: TokenResponse): CTraderTokens {
  const accessToken = data.accessToken ?? data.access_token;
  const refreshToken = data.refreshToken ?? data.refresh_token;
  const expiresIn = data.expiresIn ?? data.expires_in;
  if (!accessToken || !refreshToken || !expiresIn) {
    throw new Error("cTrader token response missing expected fields");
  }
  return { accessToken, refreshToken, expiresIn };
}

export async function exchangeCodeForTokens(code: string): Promise<CTraderTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getEnv("CTRADER_REDIRECT_URI"),
    client_id: getEnv("CTRADER_CLIENT_ID"),
    client_secret: getEnv("CTRADER_CLIENT_SECRET"),
  });
  const response = await fetch(`${TOKEN_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`cTrader token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as TokenResponse;
  if (data.errorCode || data.error) {
    throw new Error(`cTrader token exchange rejected: ${data.errorCode ?? data.error}`);
  }
  return parseTokenResponse(data);
}

export async function refreshTokens(refreshToken: string): Promise<CTraderTokens> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getEnv("CTRADER_CLIENT_ID"),
    client_secret: getEnv("CTRADER_CLIENT_SECRET"),
  });
  const response = await fetch(`${TOKEN_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`cTrader token refresh failed: ${response.status}`);
  }
  const data = (await response.json()) as TokenResponse;
  if (data.errorCode || data.error) {
    throw new Error(`cTrader token refresh rejected: ${data.errorCode ?? data.error}`);
  }
  return parseTokenResponse(data);
}
