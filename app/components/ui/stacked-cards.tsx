import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { Link } from "@remix-run/react";
import { cn } from "~/lib/utils";

export interface WalletData {
  id: string;
  name: string;
  chain: string;
  chainIcon?: string;
  address: string;
  balance: string;
  balanceUsd: string;
}

interface StackedCardsProps {
  wallets: WalletData[];
  className?: string;
}

// Chain colors for visual distinction
const chainColors: Record<string, string> = {
  ethereum: "bg-blue-500",
  polygon: "bg-purple-500",
  arbitrum: "bg-blue-400",
  optimism: "bg-red-500",
  base: "bg-blue-600",
  solana: "bg-gradient-to-r from-purple-500 to-teal-400",
  bitcoin: "bg-orange-500",
  avalanche: "bg-red-600",
};

function getChainColor(chain: string): string {
  return chainColors[chain.toLowerCase()] || "bg-zinc-500";
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function StackedCards({ wallets, className }: StackedCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? wallets.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === wallets.length - 1 ? 0 : prev + 1));
  };

  // Empty state
  if (wallets.length === 0) {
    return (
      <div className={cn("relative w-full max-w-md", className)}>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 border-dashed p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-zinc-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-white">No wallets yet</h3>
              <p className="text-sm text-zinc-500">
                Add your first wallet to start tracking your portfolio
              </p>
            </div>
            <Link
              to="/accounts/add"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get visible cards starting from current index (max 3)
  const getVisibleCards = () => {
    const visible: { wallet: WalletData; stackIndex: number }[] = [];
    for (let i = 0; i < Math.min(3, wallets.length); i++) {
      const walletIndex = (currentIndex + i) % wallets.length;
      visible.push({ wallet: wallets[walletIndex], stackIndex: i });
    }
    return visible;
  };

  const visibleCards = getVisibleCards();

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      {/* Cards stack */}
      <div className="relative">
        <AnimatePresence mode="popLayout">
          {visibleCards
            .slice()
            .reverse()
            .map(({ wallet, stackIndex }) => {
              const isTop = stackIndex === 0;

              return (
                <motion.div
                  key={wallet.id}
                  layout
                  initial={{
                    y: -stackIndex * 24,
                    scale: 1 - stackIndex * 0.03,
                    opacity: 0,
                  }}
                  animate={{
                    y: -stackIndex * 24,
                    scale: 1 - stackIndex * 0.03,
                    opacity: 1,
                  }}
                  exit={{
                    y: 50,
                    scale: 0.95,
                    opacity: 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 1,
                  }}
                  className={cn(
                    "rounded-2xl bg-zinc-900 border border-zinc-800",
                    isTop
                      ? "relative"
                      : "absolute inset-x-0 pointer-events-none"
                  )}
                  style={{
                    zIndex: 3 - stackIndex,
                  }}
                >
                  {/* Card header with chain and address */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          getChainColor(wallet.chain)
                        )}
                      />
                      <span className="text-zinc-400 text-sm capitalize">
                        {wallet.chain}
                      </span>
                    </div>
                    <span className="text-zinc-500 text-sm font-mono">
                      {truncateAddress(wallet.address)}
                    </span>
                  </div>

                  {/* Card content - only fully visible on top card */}
                  {isTop && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      className="px-5 py-5 space-y-4"
                    >
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-white">
                          {wallet.name}
                        </h3>
                        <p className="text-zinc-500 text-sm">Wallet</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-white">
                          {wallet.balanceUsd}
                        </p>
                        <p className="text-zinc-400 text-sm">{wallet.balance}</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      {wallets.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={handlePrevious}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            aria-label="Previous wallet"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Dots indicator */}
          <div className="flex items-center gap-2">
            {wallets.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === currentIndex
                    ? "bg-blue-500 w-4"
                    : "bg-zinc-600 hover:bg-zinc-500"
                )}
                aria-label={`Go to wallet ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            aria-label="Next wallet"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
