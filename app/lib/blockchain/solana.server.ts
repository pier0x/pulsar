/**
 * Solana balance fetching service using Solana JSON-RPC API
 * Uses public RPC by default, can be configured via SOLANA_RPC_URL
 */

import { config } from "~/lib/config.server";
import {
  type NativeBalance,
  type TokenBalanceResult,
  type TokenInfo,
  NETWORK_CONFIG,
  formatBalance,
} from "./types";

interface SolanaRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: { code: number; message: string };
}

interface SolanaGetBalanceResult {
  context: { slot: number };
  value: number;
}

interface TokenAccountInfo {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          owner: string;
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number;
            uiAmountString: string;
          };
        };
        type: string;
      };
      program: string;
      space: number;
    };
    executable: boolean;
    lamports: number;
    owner: string;
  };
}

interface GetTokenAccountsResult {
  context: { slot: number };
  value: TokenAccountInfo[];
}

// Simple token metadata cache (mint address -> metadata)
const tokenMetadataCache = new Map<string, TokenInfo>();

// Well-known SPL tokens with their metadata
const KNOWN_TOKENS: Record<string, Omit<TokenInfo, "network" | "contractAddress">> = {
  // USDC
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  // USDT
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  // Raydium
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": {
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
    logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
  // Marinade staked SOL
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": {
    symbol: "mSOL",
    name: "Marinade staked SOL",
    decimals: 9,
    logoUrl: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  },
  // Bonk
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoUrl: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  // JUP
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": {
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoUrl: "https://static.jup.ag/jup/icon.png",
  },
};

/**
 * Get Solana RPC URL
 */
function getSolanaRpcUrl(): string {
  return config<string>(
    "services.blockchain.solana.rpcUrl",
    "https://api.mainnet-beta.solana.com"
  );
}

/**
 * Make a Solana JSON-RPC call
 */
async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = getSolanaRpcUrl();

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
    throw new Error(`Solana RPC error: ${response.status} ${response.statusText}`);
  }

  const data: SolanaRpcResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`Solana RPC error: ${data.error.message}`);
  }

  return data.result;
}

/**
 * Fetch native SOL balance for an address
 */
export async function getSolanaBalance(address: string): Promise<NativeBalance> {
  const result = await solanaRpc<SolanaGetBalanceResult>("getBalance", [
    address,
    { commitment: "confirmed" },
  ]);

  const balanceLamports = result.value.toString();
  const cfg = NETWORK_CONFIG.solana;

  return {
    network: "solana",
    address,
    balance: balanceLamports,
    balanceFormatted: formatBalance(balanceLamports, cfg.decimals),
  };
}

/**
 * Get token metadata, using cache and known tokens list
 */
function getTokenMetadata(mintAddress: string, decimals: number): TokenInfo {
  // Check cache first
  const cached = tokenMetadataCache.get(mintAddress);
  if (cached) return cached;

  // Check known tokens
  const known = KNOWN_TOKENS[mintAddress];
  if (known) {
    const info: TokenInfo = {
      network: "solana",
      contractAddress: mintAddress,
      ...known,
    };
    tokenMetadataCache.set(mintAddress, info);
    return info;
  }

  // Return basic info for unknown tokens
  const info: TokenInfo = {
    network: "solana",
    contractAddress: mintAddress,
    symbol: `${mintAddress.slice(0, 4)}...`,
    name: "Unknown Token",
    decimals,
  };

  return info;
}

/**
 * Fetch all SPL token balances for an address
 */
export async function getSolanaTokenBalances(
  address: string
): Promise<TokenBalanceResult[]> {
  const result = await solanaRpc<GetTokenAccountsResult>(
    "getTokenAccountsByOwner",
    [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
      },
    ]
  );

  const tokenBalances: TokenBalanceResult[] = [];

  for (const account of result.value) {
    const info = account.account.data.parsed.info;
    const tokenAmount = info.tokenAmount;

    // Skip zero balances
    if (tokenAmount.amount === "0") continue;

    const token = getTokenMetadata(info.mint, tokenAmount.decimals);

    tokenBalances.push({
      token,
      balance: tokenAmount.amount,
      balanceFormatted: tokenAmount.uiAmountString,
    });
  }

  return tokenBalances;
}
