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
  // Show max 3 cards (1 front + 2 back)
  const visibleCards = cards.slice(0, 3);
  const totalVisible = visibleCards.length;

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      {/* Render cards in reverse order so the first card is on top */}
      {visibleCards
        .slice()
        .reverse()
        .map((card, reversedIndex) => {
          const index = totalVisible - 1 - reversedIndex;
          const isTop = index === 0;

          return (
            <div
              key={card.id}
              className={cn(
                "absolute inset-x-0 rounded-2xl bg-zinc-900 border border-zinc-800 transition-all duration-300",
                isTop ? "relative" : "pointer-events-none"
              )}
              style={{
                transform: `translateY(${-index * 24}px) scale(${1 - index * 0.03})`,
                zIndex: totalVisible - index,
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
                <div className="px-5 py-5 space-y-4">
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
                        <p className="text-zinc-500 text-sm">{card.user.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
