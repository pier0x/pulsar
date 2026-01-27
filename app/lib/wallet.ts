/**
 * Client-safe wallet utilities
 */

// All supported networks
export type WalletNetwork = 
  | "bitcoin" 
  | "ethereum" 
  | "arbitrum" 
  | "base" 
  | "polygon" 
  | "solana";

// Address type categories (for detection)
export type AddressType = "bitcoin" | "evm" | "solana";

// EVM-compatible networks
export const EVM_NETWORKS: WalletNetwork[] = ["ethereum", "arbitrum", "base", "polygon"];

// Network metadata
export const NETWORK_INFO: Record<WalletNetwork, { 
  displayName: string; 
  symbol: string; 
  addressType: AddressType;
  chainId?: number;
  color: string;
}> = {
  bitcoin: { 
    displayName: "Bitcoin", 
    symbol: "BTC", 
    addressType: "bitcoin",
    color: "#F7931A" 
  },
  ethereum: { 
    displayName: "Ethereum", 
    symbol: "ETH", 
    addressType: "evm",
    chainId: 1,
    color: "#627EEA" 
  },
  arbitrum: { 
    displayName: "Arbitrum", 
    symbol: "ETH", 
    addressType: "evm",
    chainId: 42161,
    color: "#28A0F0" 
  },
  base: { 
    displayName: "Base", 
    symbol: "ETH", 
    addressType: "evm",
    chainId: 8453,
    color: "#0052FF" 
  },
  polygon: { 
    displayName: "Polygon", 
    symbol: "MATIC", 
    addressType: "evm",
    chainId: 137,
    color: "#8247E5" 
  },
  solana: { 
    displayName: "Solana", 
    symbol: "SOL", 
    addressType: "solana",
    color: "#14F195" 
  },
};

/**
 * Get display name for a wallet network
 */
export function getNetworkDisplayName(network: WalletNetwork): string {
  return NETWORK_INFO[network]?.displayName ?? network;
}

/**
 * Get native token symbol for a network
 */
export function getNetworkSymbol(network: WalletNetwork): string {
  return NETWORK_INFO[network]?.symbol ?? "???";
}

/**
 * Check if a network is EVM-compatible
 */
export function isEvmNetwork(network: WalletNetwork): boolean {
  return EVM_NETWORKS.includes(network);
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
