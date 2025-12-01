/**
 * Client-safe wallet utilities
 */

export type WalletNetwork = "bitcoin" | "ethereum" | "solana";

/**
 * Get display name for a wallet network
 */
export function getNetworkDisplayName(network: WalletNetwork): string {
  switch (network) {
    case "bitcoin":
      return "Bitcoin";
    case "ethereum":
      return "Ethereum";
    case "solana":
      return "Solana";
  }
}

/**
 * Format an address for display (truncate middle)
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
