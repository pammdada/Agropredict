"use client";

import Link from "next/link";
import { useRef } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { loginAction } from "../actions";

export function LoginForm({ demoAccounts }: { demoAccounts: { email: string; role: string }[] }) {
  const formRef = useRef<HTMLDivElement>(null);
  const fill = (email: string) => {
    const input = formRef.current?.querySelector<HTMLInputElement>('input[name="email"]');
    if (input) input.value = email;
    formRef.current?.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
  };
  return (
    <div ref={formRef}>
      <ActionForm action={loginAction} className="grid gap-4">
        <Field name="email" label="Correo corporativo" type="email" autoComplete="email" placeholder="nombre@empresa.pe" required />
        <div className="grid gap-1.5">
          <Field name="password" label="Contraseña" type="password" autoComplete="current-password" required />
          <Link href="/forgot-password" className="justify-self-end text-xs font-medium text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <SubmitButton size="lg" className="h-10">
          Ingresar
        </SubmitButton>
      </ActionForm>
      <details className="mt-6 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Cuentas demo</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          La contraseña se define con <code>SEED_PASSWORD</code> (ver README). Toca un correo para usarlo.
        </p>
        <ul className="mt-2 grid gap-1">
          {demoAccounts.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => fill(a.email)} className="w-full rounded-md px-2 py-1 text-left hover:bg-background">
                <span className="font-medium">{a.email}</span>
                <span className="block text-xs text-muted-foreground">{a.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
