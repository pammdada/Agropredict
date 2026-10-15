"use client";

import { useState } from "react";
import { Copy, Link2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { NativeSelect, SelectField } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { changeRoleAction, inviteAction, removeMemberAction, revokeInvitationAction } from "./actions";

const ROLE_OPTIONS = [
  { value: "ORG_ANALYST", label: "Analista" },
  { value: "ORG_ADMIN", label: "Administrador" },
];

export function InviteForm() {
  return (
    <ActionForm action={inviteAction} className="grid gap-3">
      {({ state }) => (
        <>
          <Field name="email" label="Correo" type="email" placeholder="nombre@empresa.pe" />
          <SelectField name="role" label="Rol" options={ROLE_OPTIONS} hint="El analista corre simulaciones y registra decisiones; el administrador además gestiona equipo, SSO y facturación." />
          <SubmitButton className="justify-self-start">Crear invitación</SubmitButton>
          {state?.data?.link && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-secondary/60 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Link2 className="size-4" /> Enlace de invitación (en producción llegaría por correo)
              </p>
              <p className="mt-1 font-mono text-xs break-all">{state.data.link}</p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  void navigator.clipboard.writeText(state.data!.link);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy /> Copiar
              </Button>
            </div>
          )}
        </>
      )}
    </ActionForm>
  );
}

export function MemberControls({ membershipId, role, name }: { membershipId: string; role: string; name: string }) {
  const [value, setValue] = useState(role);
  return (
    <div className="flex items-center justify-end gap-2">
      <ActionForm action={changeRoleAction} showAlert={false} successToast="Rol actualizado" className="flex items-center gap-2">
        {({ state }) => (
          <>
            <input type="hidden" name="membershipId" value={membershipId} />
            <NativeSelect name="role" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Rol de ${name}`} className="w-40">
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            {value !== role && (
              <SubmitButton size="sm" variant="secondary">
                Guardar
              </SubmitButton>
            )}
            {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
          </>
        )}
      </ActionForm>
      <Dialog>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Retirar a ${name}`} />}>
          <UserMinus />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Retirar a {name}?</DialogTitle>
            <DialogDescription>Perderá el acceso a esta organización de inmediato. Su historial se conserva.</DialogDescription>
          </DialogHeader>
          <ActionForm action={removeMemberAction} successToast="Miembro retirado">
            <input type="hidden" name="membershipId" value={membershipId} />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancelar</DialogClose>
              <SubmitButton variant="destructive">Retirar</SubmitButton>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  return (
    <ActionForm action={revokeInvitationAction} showAlert={false} successToast="Invitación revocada">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="icon-sm" variant="ghost" aria-label="Revocar invitación">
        <X />
      </SubmitButton>
    </ActionForm>
  );
}
