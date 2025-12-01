import { Link, useLocation } from "@remix-run/react"
import { Home, Wallet, TrendingUp, Bookmark } from "lucide-react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export function Sidebar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-6 gap-4">
      {/* Logo */}
      <Link to="/" className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-6">
        <div className="w-7 h-7 text-primary-foreground font-bold text-xl">P</div>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-xl", isActive("/") && "bg-secondary/50")}
          asChild
        >
          <Link to="/" title="Dashboard">
            <Home className="h-5 w-5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-xl", isActive("/accounts") && "bg-secondary/50")}
          asChild
        >
          <Link to="/accounts" title="Accounts">
            <Wallet className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl" title="Analytics">
          <TrendingUp className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-xl" title="Saved">
          <Bookmark className="h-5 w-5" />
        </Button>
      </nav>
    </aside>
  )
}
