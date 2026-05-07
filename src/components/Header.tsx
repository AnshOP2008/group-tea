import { Link } from "@tanstack/react-router";

export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/60 border-b border-border/40">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl group-hover:rotate-12 transition-transform">🍵</span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold tracking-tight">GroupTea</span>
            <span className="text-[10px] text-muted-foreground">100% anonymous 🤫</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/results" className="chip hover:bg-white">Results</Link>
          {children}
        </nav>
      </div>
    </header>
  );
}
