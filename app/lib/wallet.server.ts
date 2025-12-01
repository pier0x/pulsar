/**
 * Server-only wallet address detection and validation utilities
 */

// Re-export client-safe utilities
export { type WalletNetwork, formatAddress, getNetworkDisplayName } from "./wallet";

export interface WalletDetectionResult {
  network: import("./wallet").WalletNetwork | null;
  valid: boolean;
  error?: string;
}

/**
 * Base58 alphabet (excludes 0, O, I, l)
 */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_REGEX = new RegExp(`^[${BASE58_ALPHABET}]+$`);

/**
 * Detect if an address is a valid Bitcoin address
 * Supports: Legacy (P2PKH), SegWit (P2SH), Native SegWit (Bech32), Taproot
 */
function isBitcoinAddress(address: string): boolean {
  // Legacy addresses (P2PKH) - start with 1, 25-34 chars
  if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return true;
  }

  // SegWit addresses (P2SH) - start with 3, 25-34 chars
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return true;
  }

  // Native SegWit (Bech32) - start with bc1q, 42-62 chars
  if (/^bc1q[a-z0-9]{38,58}$/.test(address.toLowerCase())) {
    return true;
  }

  // Taproot (Bech32m) - start with bc1p, typically 62 chars
  if (/^bc1p[a-z0-9]{58}$/.test(address.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Detect if an address is a valid Ethereum (EVM) address
 * Format: 0x followed by 40 hex characters
 */
function isEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Detect if an address is a valid Solana address
 * Format: Base58 encoded, 32-44 characters
 */
function isSolanaAddress(address: string): boolean {
  // Solana addresses are 32-44 chars in base58
  if (address.length < 32 || address.length > 44) {
    return false;
  }

  // Must be valid base58
  if (!BASE58_REGEX.test(address)) {
    return false;
  }

  // Additional check: Solana addresses don't start with numbers typically
  // and have a specific character distribution
  return true;
}

/**
 * Detect the network type of a wallet address
 * Returns the detected network or null if unknown
 */
export function detectWalletNetwork(address: string): WalletDetectionResult {
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return {
      network: null,
      valid: false,
      error: "Address is required",
    };
  }

  // Check Ethereum first (most specific pattern with 0x prefix)
  if (isEthereumAddress(trimmedAddress)) {
    return {
      network: "ethereum",
      valid: true,
    };
  }

  // Check Bitcoin (specific patterns)
  if (isBitcoinAddress(trimmedAddress)) {
    return {
      network: "bitcoin",
      valid: true,
    };
  }

  // Check Solana (base58, specific length)
  if (isSolanaAddress(trimmedAddress)) {
    return {
      network: "solana",
      valid: true,
    };
  }

  return {
    network: null,
    valid: false,
    error: "Unable to detect wallet type. Please enter a valid Bitcoin, Ethereum, or Solana address.",
  };
}
