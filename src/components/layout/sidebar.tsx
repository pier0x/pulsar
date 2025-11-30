import { Home, Wallet, TrendingUp, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Sidebar() {
  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-6 gap-4">
      {/* Logo */}
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-6">
        <div className="w-7 h-7 text-primary-foreground font-bold text-xl">M</div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl bg-secondary/50">
          <Home className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Wallet className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <TrendingUp className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Bookmark className="h-5 w-5" />
        </Button>
      </nav>
    </aside>
  )
}
