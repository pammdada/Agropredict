"use client";

import { useRef } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { providerAuthorizeAction } from "@/app/(auth)/actions";

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function ProviderForm({
  provider,
  state,
  org,
  loginHint,
  suggestions,
}: {
  provider: string;
  state: string;
  org?: string;
  loginHint?: string;
  suggestions: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (email: string) => {
    const e = ref.current?.querySelector<HTMLInputElement>('input[name="email"]');
    const n = ref.current?.querySelector<HTMLInputElement>('input[name="name"]');
    if (e) e.value = email;
    if (n) n.value = nameFromEmail(email);
  };
  return (
    <div ref={ref} className="mt-6">
      {suggestions.length > 0 && (
        <ul className="mb-4 divide-y rounded-lg border">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => pick(s)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50">
                <span className="grid size-7 place-items-center rounded-full bg-neutral-200 text-xs font-semibold">{s[0].toUpperCase()}</span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={providerAuthorizeAction} className="grid gap-3">
        <input type="hidden" name="provider" value={provider} />
        <input type="hidden" name="state" value={state} />
        {org && <input type="hidden" name="org" value={org} />}
        <Field name="email" label="Correo" type="email" defaultValue={loginHint} required />
        <Field name="name" label="Nombre" defaultValue={loginHint ? nameFromEmail(loginHint) : undefined} required />
        <SubmitButton className="mt-2 h-10">Autorizar y continuar</SubmitButton>
      </ActionForm>
    </div>
  );
}
