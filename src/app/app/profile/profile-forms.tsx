"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { changePasswordAction, revokeSessionAction, updateProfileAction } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  return (
    <ActionForm action={updateProfileAction} className="grid gap-4">
      <Field name="name" label="Nombre completo" defaultValue={name} />
      <Field name="email" label="Correo" defaultValue={email} disabled />
      <SubmitButton className="justify-self-start">Guardar</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  return (
    <ActionForm action={changePasswordAction} className="grid gap-4">
      {hasPassword && <Field name="current" label="Contraseña actual" type="password" autoComplete="current-password" />}
      <Field name="password" label="Nueva contraseña" type="password" autoComplete="new-password" />
      <Field name="confirm" label="Confirmar contraseña" type="password" autoComplete="new-password" />
      <SubmitButton className="justify-self-start">{hasPassword ? "Actualizar contraseña" : "Crear contraseña"}</SubmitButton>
    </ActionForm>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <ActionForm action={revokeSessionAction} showAlert={false} successToast="Sesión cerrada">
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton variant="outline" size="sm">
        Cerrar
      </SubmitButton>
    </ActionForm>
  );
}
