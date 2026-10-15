"use client";

import { useRef, useState } from "react";
import { Check, CreditCard, Lock, Smartphone } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Entitlements } from "@/db/schema";
import { cn } from "@/lib/utils";
import { checkoutAction } from "../actions";

type Plan = { code: string; name: string; description: string; priceCents: number; entitlements: Entitlements };

const pen = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);
const lim = (n: number, unit: string) => (n === -1 ? `${unit} ilimitados` : `${n} ${unit}`);

export function Checkout({
  plans,
  currentCode,
  currentStatus,
  initialCode,
  testCards,
  yapeCodes,
}: {
  plans: Plan[];
  currentCode: string;
  currentStatus: string;
  initialCode: string;
  testCards: { number: string; label: string }[];
  yapeCodes: { code: string; outcome: string }[];
}) {
  const [code, setCode] = useState(initialCode);
  const [method, setMethod] = useState<"card" | "yape">("card");
  const formRef = useRef<HTMLDivElement>(null);
  const plan = plans.find((p) => p.code === code)!;
  const igv = Math.round(plan.priceCents * 0.18);
  const isCurrentActive = code === currentCode && currentStatus === "active";

  const fillCard = (number: string) => {
    const set = (name: string, v: string) => {
      const el = formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (el) el.value = v;
    };
    set("number", number);
    set("expiry", "12/29");
    set("cvv", "123");
    set("holder", "Carlos Mendoza");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <fieldset>
        <legend className="mb-3 font-semibold">1. Elige el plan</legend>
        <div className="grid gap-3">
          {plans.map((p) => (
            <button
              key={p.code}
              type="button"
              aria-pressed={code === p.code}
              onClick={() => setCode(p.code)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                code === p.code ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {p.name}
                    {p.code === currentCode && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">Plan actual</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-semibold">{pen(p.priceCents)}</span>
                  <span className="block text-xs text-muted-foreground">/ mes + IGV</span>
                </p>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <li>{lim(p.entitlements.maxFarms, "fundos")}</li>
                <li>{lim(p.entitlements.maxUsers, "usuarios")}</li>
                <li>{p.entitlements.maxSimulationsPerMonth === -1 ? "Simulaciones ilimitadas" : `${p.entitlements.maxSimulationsPerMonth} simulaciones/mes`}</li>
                <li className={p.entitlements.coldChain ? "text-success" : ""}>{p.entitlements.coldChain ? "✓ Cadena de frío" : "Sin cadena de frío"}</li>
              </ul>
            </button>
          ))}
        </div>
      </fieldset>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>2. Pago</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
            <div className="flex justify-between">
              <dt>Plan {plan.name} (30 días)</dt>
              <dd className="tabular-nums">{pen(plan.priceCents)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>IGV (18 %)</dt>
              <dd className="tabular-nums">{pen(igv)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
              <dt>Total a pagar</dt>
              <dd className="tabular-nums">{pen(plan.priceCents + igv)}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Medio de pago">
            {(
              [
                ["card", "Tarjeta", CreditCard],
                ["yape", "Yape", Smartphone],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={method === key}
                onClick={() => setMethod(key)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition",
                  method === key ? "border-primary bg-secondary text-secondary-foreground" : "hover:bg-muted",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <div ref={formRef} className="mt-4">
            <ActionForm action={checkoutAction} className="grid gap-3" key={method}>
              <input type="hidden" name="plan" value={code} />
              <input type="hidden" name="method" value={method} />
              {method === "card" ? (
                <>
                  <Field name="holder" label="Titular" autoComplete="off" />
                  <Field name="number" label="Número de tarjeta" inputMode="numeric" autoComplete="off" placeholder="4111 1111 1111 1111" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="expiry" label="Vencimiento" placeholder="MM/AA" autoComplete="off" />
                    <Field name="cvv" label="CVV" inputMode="numeric" autoComplete="off" maxLength={4} />
                  </div>
                  <div className="rounded-lg border border-dashed p-2.5 text-xs">
                    <p className="font-medium">Tarjetas de prueba (toca para usar)</p>
                    <ul className="mt-1 grid gap-0.5">
                      {testCards.map((c) => (
                        <li key={c.number}>
                          <button type="button" onClick={() => fillCard(c.number)} className="font-mono text-primary hover:underline">
                            {c.number}
                          </button>{" "}
                          <span className="text-muted-foreground">· {c.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <Field name="phone" label="Celular asociado a Yape" inputMode="numeric" maxLength={9} placeholder="987654321" autoComplete="off" />
                  <Field
                    name="approvalCode"
                    label="Código de aprobación"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    hint="Lo generas en tu app Yape (flujo simulado)."
                  />
                  <p className="rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
                    Códigos de prueba: {yapeCodes.map((c) => `${c.code} (${c.outcome === "approved" ? "aprobado" : "rechazado"})`).join(", ")}.
                  </p>
                </>
              )}
              <SubmitButton size="lg" className="mt-1 h-10" disabled={isCurrentActive}>
                {isCurrentActive ? (
                  <>
                    <Check /> Ya tienes este plan
                  </>
                ) : (
                  <>
                    <Lock /> Pagar {pen(plan.priceCents + igv)}
                  </>
                )}
              </SubmitButton>
              <p className="text-center text-[11px] text-muted-foreground">Pasarela simulada (SimulatedProvider). No se realiza ningún cargo real.</p>
            </ActionForm>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
