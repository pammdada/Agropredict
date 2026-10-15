"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { ssoDiscoverAction } from "../../actions";

export default function SsoPage() {
  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Ingresar con SSO de mi empresa</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Escribe tu correo corporativo. Buscaremos el proveedor de identidad (OIDC) configurado para tu dominio.
      </p>
      <ActionForm action={ssoDiscoverAction} className="mt-8 grid gap-4">
        <Field name="email" label="Correo corporativo" type="email" placeholder="nombre@valleica.pe" autoComplete="email" required />
        <SubmitButton size="lg" className="h-10">
          Continuar
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Demo: el dominio <strong>@valleica.pe</strong> tiene SSO configurado con un proveedor OIDC de prueba. Un correo nuevo de ese
        dominio se aprovisiona automáticamente (JIT) con el rol por defecto.
      </p>
    </div>
  );
}
