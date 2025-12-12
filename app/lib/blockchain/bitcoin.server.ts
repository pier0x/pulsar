/**
 * Bitcoin balance fetching service using Blockstream.info API
 * No API key required - free public API
 */

import {
  type NativeBalance,
  type TokenBalanceResult,
  NETWORK_CONFIG,
  formatBalance,
} from "./types";

const BLOCKSTREAM_API = "https://blockstream.info/api";

interface BlockstreamAddressResponse {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

/**
 * Fetch Bitcoin balance for an address
 */
export async function getBitcoinBalance(address: string): Promise<NativeBalance> {
  const response = await fetch(`${BLOCKSTREAM_API}/address/${address}`);

  if (!response.ok) {
    throw new Error(`Blockstream API error: ${response.status} ${response.statusText}`);
  }

  const data: BlockstreamAddressResponse = await response.json();

  // Calculate balance: confirmed + unconfirmed
  const confirmedBalance =
    data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
  const unconfirmedBalance =
    data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
  const totalBalance = confirmedBalance + unconfirmedBalance;

  const balanceStr = totalBalance.toString();
  const config = NETWORK_CONFIG.bitcoin;

  return {
    network: "bitcoin",
    address,
    balance: balanceStr,
    balanceFormatted: formatBalance(balanceStr, config.decimals),
  };
}

/**
 * Bitcoin doesn't have tokens in the traditional sense
 * Returns empty array (could be extended for Ordinals/BRC-20 in the future)
 */
export async function getBitcoinTokenBalances(
  _address: string
): Promise<TokenBalanceResult[]> {
  // Bitcoin doesn't have native token support like ERC-20 or SPL
  // Could be extended for BRC-20, Runes, etc. in the future
  return [];
}
