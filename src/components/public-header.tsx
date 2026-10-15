import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-4">
          <Link href="/#como-funciona" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Cómo funciona
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            Planes
          </Link>
          <Button variant="ghost" render={<Link href="/login" />} nativeButton={false}>
            Ingresar
          </Button>
          <Button render={<Link href="/register" />} nativeButton={false} className="hidden sm:inline-flex">
            Registrar empresa
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
        <p>© 2026 AgroPredic · MVP académico (APF2), Lima, Perú.</p>
        <p>Los resultados del motor v0 son datos demo, no pronósticos reales.</p>
      </div>
    </footer>
  );
}
