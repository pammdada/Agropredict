"use client";

import Link from "next/link";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/forms";
import { cn } from "@/lib/utils";
import { registerAction } from "../actions";

const pen = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(cents / 100);

export function RegisterForm({
  plans,
  defaultPlan,
}: {
  plans: { code: string; name: string; priceCents: number; description: string }[];
  defaultPlan: string;
}) {
  return (
    <ActionForm action={registerAction} className="mt-8 grid gap-4">
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Empresa</legend>
        <Field name="company" label="Razón social" placeholder="Agroexportadora Ejemplo S.A.C." required />
        <Field name="ruc" label="RUC" inputMode="numeric" maxLength={11} placeholder="20XXXXXXXXX" required />
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mt-2 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Administrador</legend>
        <Field name="name" label="Nombre completo" autoComplete="name" required />
        <Field name="email" label="Correo corporativo" type="email" autoComplete="email" required />
        <Field name="password" label="Contraseña" type="password" autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." required />
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mt-2 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Plan</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p) => (
            <label
              key={p.code}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-lg border bg-card p-3 text-sm transition-colors has-checked:border-primary has-checked:bg-secondary has-checked:ring-2 has-checked:ring-primary/20",
              )}
            >
              <input type="radio" name="plan" value={p.code} defaultChecked={p.code === defaultPlan} className="sr-only" />
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-muted-foreground">{pen(p.priceCents)}/mes + IGV</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Sin cobro durante la prueba. Compara planes en{" "}
          <Link href="/pricing" className="text-primary hover:underline">
            planes y precios
          </Link>
          .
        </p>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" className="mt-1 size-4 accent-[var(--primary)]" />
        <span>
          Acepto los términos del servicio y el tratamiento de datos personales conforme a la Ley N.º 29733.
          <FieldError name="terms" />
        </span>
      </label>
      <SubmitButton size="lg" className="h-10">
        Crear organización
      </SubmitButton>
    </ActionForm>
  );
}
