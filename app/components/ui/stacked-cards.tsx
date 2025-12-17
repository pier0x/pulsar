import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface CardData {
  id: string;
  date: string;
  time: string;
  title?: string;
  amount?: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

interface StackedCardsProps {
  cards: CardData[];
  className?: string;
}

export function StackedCards({ cards, className }: StackedCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  };

  // Get visible cards starting from current index (max 3)
  const getVisibleCards = () => {
    const visible: { card: CardData; stackIndex: number }[] = [];
    for (let i = 0; i < Math.min(3, cards.length); i++) {
      const cardIndex = (currentIndex + i) % cards.length;
      visible.push({ card: cards[cardIndex], stackIndex: i });
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
            .map(({ card, stackIndex }) => {
              const isTop = stackIndex === 0;

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{
                    y: -stackIndex * 24,
                    scale: 1 - stackIndex * 0.03,
                    opacity: 0
                  }}
                  animate={{
                    y: -stackIndex * 24,
                    scale: 1 - stackIndex * 0.03,
                    opacity: 1,
                  }}
                  exit={{
                    y: 50,
                    scale: 0.95,
                    opacity: 0
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 1,
                  }}
                  className={cn(
                    "rounded-2xl bg-zinc-900 border border-zinc-800",
                    isTop ? "relative" : "absolute inset-x-0 pointer-events-none"
                  )}
                  style={{
                    zIndex: 3 - stackIndex,
                  }}
                >
                  {/* Card header with date and time */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-sm">{card.date}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-zinc-400 text-sm">{card.time}</span>
                  </div>

                  {/* Card content - only fully visible on top card */}
                  {isTop && (card.title || card.amount || card.user) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      className="px-5 py-5 space-y-4"
                    >
                      {card.title && (
                        <h3 className="text-xl font-semibold text-white">
                          {card.title}
                        </h3>
                      )}
                      {card.amount && (
                        <p className="text-emerald-400 text-lg">{card.amount}</p>
                      )}
                      {card.user && (
                        <div className="flex items-center gap-3 pt-2">
                          {card.user.avatar ? (
                            <img
                              src={card.user.avatar}
                              alt={card.user.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                              <span className="text-zinc-300 text-sm font-medium">
                                {card.user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-white text-sm font-medium">
                              {card.user.name}
                            </p>
                            <p className="text-zinc-500 text-sm">
                              {card.user.email}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      {cards.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={handlePrevious}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            aria-label="Previous card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Dots indicator */}
          <div className="flex items-center gap-2">
            {cards.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === currentIndex
                    ? "bg-blue-500 w-4"
                    : "bg-zinc-600 hover:bg-zinc-500"
                )}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            aria-label="Next card"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
