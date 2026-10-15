import Link from "next/link";
import { ArrowRight, ClipboardCheck, CloudSun, ShieldCheck, Snowflake, Sprout, TrendingDown } from "lucide-react";
import { DemoBadge } from "@/components/brand";
import { PublicFooter, PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";

function ResultPreview() {
  const rows = [
    { label: "Optimista", value: "17.9", pct: 74, tone: "bg-success" },
    { label: "Central", value: "14.6", pct: 60, tone: "bg-primary" },
    { label: "Pesimista", value: "11.2", pct: 46, tone: "bg-critical" },
  ];
  return (
    <div className="relative rounded-2xl bg-card p-5 shadow-xl ring-1 ring-foreground/10 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Fundo Santa Rosa · Uva Red Globe · Ica</p>
          <p className="mt-0.5 font-semibold">Campaña 26-27 · Niño fuerte</p>
        </div>
        <DemoBadge />
      </div>
      <p className="mt-5 text-xs font-medium text-muted-foreground">Volumen exportable (t/ha)</p>
      <div className="mt-2 grid gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="h-2.5 rounded-full bg-muted">
              <span className={`block h-full rounded-full ${r.tone}`} style={{ width: `${r.pct}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
        <TrendingDown className="size-4 shrink-0 text-critical" /> Central −25 % vs. campaña base · Confianza alta (9 años de historial)
      </div>
      <div className="mt-3 rounded-lg border border-dashed border-primary/40 p-3">
        <p className="text-xs font-semibold text-primary">Acción recomendada · prioridad alta</p>
        <p className="mt-0.5 text-sm">Renegociar volúmenes comprometidos con compradores</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          <ClipboardCheck className="size-3.5" /> Registrar como decisión
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_85%_20%,oklch(0.93_0.07_85/.7),transparent),radial-gradient(50%_50%_at_10%_90%,oklch(0.92_0.05_150/.6),transparent)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                <Sprout className="size-3.5 text-primary" /> Para gerencias de planeamiento y logística agroexportadora
              </p>
              <h1 className="mt-5 text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
                Simula la campaña.
                <br />
                <span className="text-primary">Decide antes.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                AgroPredic convierte escenarios de El Niño y riesgos de cadena de frío en un rango de resultados, un nivel de confianza y una acción
                recomendada que tu equipo registra y sigue.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="h-11 px-5" render={<Link href="/register" />} nativeButton={false}>
                  Empezar prueba de 14 días <ArrowRight />
                </Button>
                <Button size="lg" variant="outline" className="h-11 px-5" render={<Link href="/login" />} nativeButton={false}>
                  Ver la demo
                </Button>
              </div>
            </div>
            <ResultPreview />
          </div>
        </section>

        <section id="como-funciona" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold">De la incertidumbre a una decisión registrada</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                { icon: CloudSun, title: "1. Elige el escenario", text: "Fundo, cultivo, campaña y escenario climático: neutro, Niño moderado, Niño fuerte o un índice de anomalía propio." },
                { icon: TrendingDown, title: "2. Lee el rango", text: "Resultado optimista, central y pesimista, con nivel de confianza y los factores que más pesan." },
                { icon: ClipboardCheck, title: "3. Registra la decisión", text: "Cada resultado trae acciones priorizadas. Conviértelas en decisiones con responsable y fecha." },
              ].map((s) => (
                <li key={s.title}>
                  <s.icon className="size-7 text-primary" />
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="bg-field-pattern rounded-2xl bg-sidebar p-8 text-sidebar-foreground">
            <Sprout className="size-7 text-sidebar-primary" />
            <h3 className="mt-4 text-2xl font-semibold text-white">Rendimiento por campaña</h3>
            <p className="mt-2 text-sm text-sidebar-foreground/80">Volumen exportable en t/ha por fundo, con horizonte de meses y curva mensual de cosecha.</p>
          </div>
          <div className="rounded-2xl bg-accent p-8 text-accent-foreground">
            <Snowflake className="size-7" />
            <h3 className="mt-4 text-2xl font-semibold">Riesgo de cadena de frío</h3>
            <p className="mt-2 text-sm">Merma estimada por envío y por tramo del corredor Ica – Callao, con horizonte de días. Disponible en el plan Pro.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex flex-col items-start gap-6 rounded-2xl border bg-card p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Multiempresa y seguro desde el primer día</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" /> Roles por organización, SSO corporativo y datos aislados entre empresas.
              </p>
            </div>
            <Button size="lg" render={<Link href="/pricing" />} nativeButton={false}>
              Ver planes y precios
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
