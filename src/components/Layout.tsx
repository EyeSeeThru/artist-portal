import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./ThemeToggle";
import { ArtistDetailPanel } from "./ArtistDetailPanel";
import { ArtistSearch } from "./ArtistSearch";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "./ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: "/gallery", label: "Gallery" },
    { href: "/timeline", label: "Timeline" },
    { href: "/movements", label: "Movements" },
    { href: "/map", label: "Map" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground transition-colors selection:bg-primary/20">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center gap-4 md:gap-6">
          <Link href="/" className="font-serif text-2xl tracking-tight font-medium shrink-0">
            Artist Portal
          </Link>

          <div className="hidden md:flex flex-1 justify-center">
            <ArtistSearch variant="desktop" />
          </div>

          <div className="hidden md:flex items-center gap-6 shrink-0">
            <nav className="flex items-center gap-6 text-sm font-medium">
              {links.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="w-px h-4 bg-border" />
            <ThemeToggle />
          </div>

          <div className="md:hidden flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[80vw] sm:w-[350px]">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="mt-8 flex flex-col gap-6">
                  <Link href="/" className="font-serif text-2xl font-medium">
                    Artist Portal
                  </Link>
                  <ArtistSearch
                    variant="mobile"
                    onResultSelect={() => setMobileMenuOpen(false)}
                  />
                  <nav className="flex flex-col gap-6">
                    {links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`text-lg transition-colors hover:text-primary ${location === link.href ? "text-primary font-medium" : "text-muted-foreground"}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {location !== "/map" && (
        <footer className="border-t border-border/40 bg-muted/20 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 text-center md:text-left text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} Artist Portal.</p>
            <p className="max-w-md text-center md:text-right text-xs leading-relaxed opacity-80">
              Artist biographies are sourced from Wikipedia. Gallery cards and detail-page artwork images are drawn from Wikipedia's open-access media, the Metropolitan Museum of Art's Open Access collection (CC0), and the Art Institute of Chicago's API. Each image retains its source attribution and license.
            </p>
          </div>
        </footer>
      )}

      <ArtistDetailPanel />
    </div>
  );
}
