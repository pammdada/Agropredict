"use client";

import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver a ingresar
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Recupera tu contraseña</h1>
      <p className="mt-2 text-sm text-muted-foreground">Te enviaremos un enlace de un solo uso, válido por 60 minutos.</p>
      <ActionForm action={forgotPasswordAction} className="mt-8 grid gap-4">
        {({ state }) => (
          <>
            <Field name="email" label="Correo" type="email" autoComplete="email" required />
            <SubmitButton size="lg" className="h-10">
              Enviar enlace
            </SubmitButton>
            {state?.data?.link && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-secondary/60 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Link2 className="size-4" /> Enlace de demo (en producción llegaría por correo)
                </p>
                <Link href={state.data.link} className="mt-1 block break-all text-primary underline">
                  {state.data.link}
                </Link>
              </div>
            )}
          </>
        )}
      </ActionForm>
    </div>
  );
}
