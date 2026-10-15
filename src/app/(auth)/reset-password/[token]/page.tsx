"use client";

import { use } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { resetPasswordAction } from "../../actions";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Crea una nueva contraseña</h1>
      <p className="mt-2 text-sm text-muted-foreground">Al guardarla cerraremos todas tus sesiones abiertas.</p>
      <ActionForm action={resetPasswordAction} className="mt-8 grid gap-4">
        <input type="hidden" name="token" value={token} />
        <Field name="password" label="Nueva contraseña" type="password" autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." required />
        <Field name="confirm" label="Confirmar contraseña" type="password" autoComplete="new-password" required />
        <SubmitButton size="lg" className="h-10">
          Guardar contraseña
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
