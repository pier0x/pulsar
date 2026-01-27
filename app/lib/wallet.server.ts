/**
 * Server-only wallet address detection and validation utilities
 */

// Re-export client-safe utilities
export { 
  type WalletNetwork, 
  type AddressType,
  formatAddress, 
  getNetworkDisplayName,
  getNetworkSymbol,
  isEvmNetwork,
  EVM_NETWORKS,
  NETWORK_INFO,
} from "./wallet";

import type { WalletNetwork, AddressType } from "./wallet";

export interface AddressDetectionResult {
  addressType: AddressType | null;
  suggestedNetwork: WalletNetwork | null;
  valid: boolean;
  error?: string;
}

export interface WalletValidationResult {
  network: WalletNetwork | null;
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
 * Detect if an address is a valid EVM address
 * Format: 0x followed by 40 hex characters
 * Works for Ethereum, Arbitrum, Base, Polygon, etc.
 */
function isEvmAddress(address: string): boolean {
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

  return true;
}

/**
 * Detect the address type (bitcoin, evm, solana)
 * For EVM addresses, the specific network must be selected by the user
 */
export function detectAddressType(address: string): AddressDetectionResult {
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return {
      addressType: null,
      suggestedNetwork: null,
      valid: false,
      error: "Address is required",
    };
  }

  // Check EVM first (most specific pattern with 0x prefix)
  if (isEvmAddress(trimmedAddress)) {
    return {
      addressType: "evm",
      suggestedNetwork: "ethereum", // Default suggestion, user can change
      valid: true,
    };
  }

  // Check Bitcoin (specific patterns)
  if (isBitcoinAddress(trimmedAddress)) {
    return {
      addressType: "bitcoin",
      suggestedNetwork: "bitcoin",
      valid: true,
    };
  }

  // Check Solana (base58, specific length)
  if (isSolanaAddress(trimmedAddress)) {
    return {
      addressType: "solana",
      suggestedNetwork: "solana",
      valid: true,
    };
  }

  return {
    addressType: null,
    suggestedNetwork: null,
    valid: false,
    error: "Unable to detect wallet type. Please enter a valid Bitcoin, EVM, or Solana address.",
  };
}

/**
 * Validate a wallet address for a specific network
 */
export function validateWalletForNetwork(address: string, network: WalletNetwork): WalletValidationResult {
  const trimmedAddress = address.trim();
  const detection = detectAddressType(trimmedAddress);

  if (!detection.valid) {
    return {
      network: null,
      valid: false,
      error: detection.error,
    };
  }

  // Check if the address type matches the selected network
  const isEvm = ["ethereum", "arbitrum", "base", "polygon"].includes(network);
  
  if (network === "bitcoin" && detection.addressType !== "bitcoin") {
    return {
      network: null,
      valid: false,
      error: "This is not a valid Bitcoin address",
    };
  }

  if (network === "solana" && detection.addressType !== "solana") {
    return {
      network: null,
      valid: false,
      error: "This is not a valid Solana address",
    };
  }

  if (isEvm && detection.addressType !== "evm") {
    return {
      network: null,
      valid: false,
      error: `This is not a valid ${network} address`,
    };
  }

  return {
    network,
    valid: true,
  };
}

/**
 * Legacy function for backwards compatibility
 * Auto-detects network (defaults to ethereum for EVM addresses)
 */
export function detectWalletNetwork(address: string): WalletValidationResult {
  const detection = detectAddressType(address);
  
  if (!detection.valid) {
    return {
      network: null,
      valid: false,
      error: detection.error,
    };
  }

  return {
    network: detection.suggestedNetwork,
    valid: true,
  };
}
