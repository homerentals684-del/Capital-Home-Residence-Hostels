import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Capital Home Residence logo" className="h-14 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }}>Home</Link>
          <a href="/#rooms" className="hover:text-primary">Rooms</a>
          <a href="/#contact" className="hover:text-primary">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/login">Login</Link></Button>
          <Button asChild><Link to="/register">Register</Link></Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="bg-gradient-navy text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl">Capital Home Residence</p>
          <p className="mt-2 text-sm text-primary-foreground/70">Safe, comfortable student living.</p>
        </div>
        <div className="text-sm text-primary-foreground/80">
          <p className="font-semibold text-gold">Contact</p>
          <p className="mt-2">okindatechhub@gmail.com</p>
        </div>
        <div className="text-sm text-primary-foreground/60 md:text-right">
          © {new Date().getFullYear()} Capital Home Residence Rentals
        </div>
      </div>
    </footer>
  );
}
