/**
 * Helius provider for Solana
 * Uses DAS (Digital Asset Standard) API for comprehensive token data
 */

export interface NativeBalanceResult {
  success: true;
  balance: string; // In lamports
  decimals: number;
}

export interface TokenInfo {
  contractAddress: string; // Mint address for SPL tokens
  symbol: string;
  name: string | null;
  decimals: number;
  balance: string; // Raw balance
  logoUrl: string | null;
}

export interface TokenBalancesResult {
  success: true;
  tokens: TokenInfo[];
}

export interface FetchError {
  success: false;
  error: {
    type: "api_error" | "timeout" | "rate_limit" | "parse_error" | "network_error";
    message: string;
    details?: unknown;
  };
}

type BalanceResult = NativeBalanceResult | FetchError;
type TokensResult = TokenBalancesResult | FetchError;

const HELIUS_RPC_URL = "https://mainnet.helius-rpc.com";

/**
 * Make a Helius JSON-RPC request
 */
async function heliusRpc(
  apiKey: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const url = `${HELIUS_RPC_URL}/?api-key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw { type: "rate_limit", message: "Rate limited by Helius" };
    }
    throw { type: "api_error", message: `HTTP ${response.status}` };
  }

  const data = await response.json();
  
  if (data.error) {
    throw { type: "api_error", message: data.error.message, details: data.error };
  }

  return data.result;
}

/**
 * Fetch native SOL balance
 */
export async function fetchSolanaNativeBalance(
  address: string,
  apiKey: string
): Promise<BalanceResult> {
  try {
    const result = await heliusRpc(apiKey, "getBalance", [address]);
    const balanceData = result as { value: number };

    return {
      success: true,
      balance: balanceData.value.toString(),
      decimals: 9, // SOL has 9 decimals (lamports)
    };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch SOL balance",
        details: error,
      },
    };
  }
}

/**
 * Fetch SPL token balances using DAS API
 */
export async function fetchSolanaTokenBalances(
  address: string,
  apiKey: string
): Promise<TokensResult> {
  try {
    // Use getAssetsByOwner (DAS API) for comprehensive token data
    const result = await heliusRpc(apiKey, "getAssetsByOwner", [
      {
        ownerAddress: address,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: false,
        },
      },
    ]);

    const assetsData = result as {
      items: Array<{
        id: string; // Mint address
        content?: {
          metadata?: {
            name?: string;
            symbol?: string;
          };
          links?: {
            image?: string;
          };
        };
        token_info?: {
          balance: number;
          decimals: number;
          symbol?: string;
        };
        interface: string;
      }>;
    };

    // Filter for fungible tokens only
    const tokens: TokenInfo[] = assetsData.items
      .filter(
        (asset) =>
          asset.interface === "FungibleToken" ||
          asset.interface === "FungibleAsset"
      )
      .filter((asset) => asset.token_info && asset.token_info.balance > 0)
      .map((asset) => ({
        contractAddress: asset.id,
        symbol:
          asset.token_info?.symbol ||
          asset.content?.metadata?.symbol ||
          "???",
        name: asset.content?.metadata?.name || null,
        decimals: asset.token_info?.decimals || 9,
        balance: asset.token_info!.balance.toString(),
        logoUrl: asset.content?.links?.image || null,
      }));

    return { success: true, tokens };
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    return {
      success: false,
      error: {
        type: (err.type as FetchError["error"]["type"]) || "api_error",
        message: err.message || "Failed to fetch SPL token balances",
        details: error,
      },
    };
  }
}

/**
 * Fetch all Solana balances (native + tokens)
 */
export async function fetchSolanaBalances(
  address: string,
  apiKey: string
): Promise<{
  native: BalanceResult;
  tokens: TokensResult;
}> {
  const [native, tokens] = await Promise.all([
    fetchSolanaNativeBalance(address, apiKey),
    fetchSolanaTokenBalances(address, apiKey),
  ]);

  return { native, tokens };
}

/**
 * Test Helius API key by making a simple request
 */
export async function testHeliusConnection(apiKey: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await heliusRpc(apiKey, "getHealth", []);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || "Connection failed" };
  }
}
