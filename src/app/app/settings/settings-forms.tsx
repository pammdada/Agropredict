"use client";

import { useRef } from "react";
import { PlugZap } from "lucide-react";
import { ActionForm, Field, FormAlert, SubmitButton } from "@/components/forms";
import { SelectField } from "@/components/native-select";
import { saveSsoAction, testSsoAction, updateOrgAction } from "./actions";

export function OrgForm({ name, ruc, slug }: { name: string; ruc: string; slug: string }) {
  return (
    <ActionForm action={updateOrgAction} className="grid gap-4">
      <Field name="name" label="Razón social" defaultValue={name} />
      <Field name="ruc" label="RUC" defaultValue={ruc} inputMode="numeric" maxLength={11} />
      <Field name="slug" label="Identificador" defaultValue={slug} disabled hint="Se usa en URLs e integraciones; no editable." />
      <SubmitButton className="justify-self-start">Guardar</SubmitButton>
    </ActionForm>
  );
}

type Sso = { issuer: string; clientId: string; clientSecretHint: string; allowedDomains: string; defaultRole: string; enabled: boolean };

export function SsoForm({ config }: { config: Sso | null }) {
  const issuerRef = useRef<HTMLDivElement>(null);
  return (
    <div className="grid gap-4">
      <ActionForm action={saveSsoAction} className="grid gap-4 sm:grid-cols-2">
        <div ref={issuerRef} className="sm:col-span-2">
          <Field name="issuer" label="Issuer URL" defaultValue={config?.issuer} placeholder="https://idp.miempresa.pe/realms/corporativo" />
        </div>
        <Field name="clientId" label="Client ID" defaultValue={config?.clientId} autoComplete="off" />
        <Field
          name="clientSecret"
          label="Client secret"
          type="password"
          autoComplete="new-password"
          placeholder={config ? config.clientSecretHint : ""}
          hint={config ? "Déjalo vacío para conservar el actual." : "Se guarda cifrado; nunca se vuelve a mostrar."}
        />
        <Field
          name="allowedDomains"
          label="Dominios permitidos"
          defaultValue={config?.allowedDomains}
          placeholder="miempresa.pe, filial.pe"
          className="sm:col-span-2"
          hint="Separados por coma. Un dominio solo puede pertenecer a una organización."
        />
        <SelectField
          name="defaultRole"
          label="Rol por defecto (JIT)"
          defaultValue={config?.defaultRole ?? "ORG_ANALYST"}
          options={[
            { value: "ORG_ANALYST", label: "Analista" },
            { value: "ORG_ADMIN", label: "Administrador" },
          ]}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={config?.enabled ?? true} className="size-4 accent-[var(--primary)]" />
          SSO habilitado
        </label>
        <div className="sm:col-span-2">
          <SubmitButton>Guardar configuración</SubmitButton>
        </div>
      </ActionForm>
      <ActionForm
        action={(state, fd) => {
          fd.set("issuer", issuerRef.current?.querySelector<HTMLInputElement>('input[name="issuer"]')?.value ?? "");
          return testSsoAction(state, fd);
        }}
        showAlert={false}
        className="grid gap-2 border-t pt-4"
      >
        <SubmitButton variant="outline" className="justify-self-start">
          <PlugZap /> Probar conexión
        </SubmitButton>
        <FormAlert />
      </ActionForm>
    </div>
  );
}
