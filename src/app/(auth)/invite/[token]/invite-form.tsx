"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { acceptInvitationAction } from "../../actions";

export function InviteForm({ token, mode }: { token: string; mode: "new" | "existing" | "signed-in" }) {
  return (
    <ActionForm action={acceptInvitationAction} className="mt-8 grid gap-4">
      <input type="hidden" name="token" value={token} />
      {mode === "new" && (
        <>
          <Field name="name" label="Nombre completo" autoComplete="name" required />
          <Field name="password" label="Crea una contraseña" type="password" autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." required />
        </>
      )}
      {mode === "existing" && (
        <Field name="password" label="Tu contraseña actual" type="password" autoComplete="current-password" hint="Ya tienes cuenta en AgroPredic: confirma tu identidad." required />
      )}
      <SubmitButton size="lg" className="h-10">
        Aceptar invitación
      </SubmitButton>
    </ActionForm>
  );
}
