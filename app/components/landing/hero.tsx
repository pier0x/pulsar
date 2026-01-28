import { motion } from "framer-motion";
import { Logo } from "~/components/ui";

interface HeroProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export function Hero({ onLoginClick, onRegisterClick }: HeroProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 p-4">
      {/* Background gradient effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 flex justify-center"
        >
          <Logo size="lg" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight"
        >
          Track Your Crypto
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">
            Portfolio
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-lg md:text-xl text-zinc-400 mb-10 max-w-lg mx-auto"
        >
          Monitor all your wallets across multiple chains in one beautiful dashboard.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={onRegisterClick}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
          >
            Get Started
          </button>
          <button
            onClick={onLoginClick}
            className="px-8 py-3 rounded-xl bg-zinc-800 text-white font-semibold text-lg hover:bg-zinc-700 transition-all duration-200 border border-zinc-700"
          >
            Sign In
          </button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute bottom-8 text-zinc-600 text-sm"
      >
        Built for crypto enthusiasts
      </motion.div>
    </div>
  );
}
