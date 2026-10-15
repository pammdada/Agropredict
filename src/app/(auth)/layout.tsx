import { CloudSun, Route, Sprout } from "lucide-react";
import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-field-pattern relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo inverted href="/" />
        <div className="max-w-md space-y-6">
          <h2 className="text-4xl leading-tight font-semibold text-white">
            Del pronóstico a la decisión, <span className="text-sidebar-primary">antes</span> de que llegue El Niño.
          </h2>
          <ul className="space-y-3 text-sm text-sidebar-foreground/85">
            <li className="flex gap-3">
              <CloudSun className="size-5 shrink-0 text-sidebar-primary" aria-hidden />
              Escenarios de clima con rango optimista, central y pesimista.
            </li>
            <li className="flex gap-3">
              <Route className="size-5 shrink-0 text-sidebar-primary" aria-hidden />
              Merma de cadena de frío por tramo del corredor Ica – Callao.
            </li>
            <li className="flex gap-3">
              <Sprout className="size-5 shrink-0 text-sidebar-primary" aria-hidden />
              Cada resultado termina en una acción recomendada que se registra como decisión.
            </li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/60">MVP académico APF2 · Los resultados del motor v0 son datos demo.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
