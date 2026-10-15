"use client";

import { Eye } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { SelectField } from "@/components/native-select";
import { changeOrgPlanAction, setOrgStatusAction, setSubscriptionStatusAction, startImpersonationAction } from "../../actions";

export function ImpersonateForm({ orgId }: { orgId: string }) {
  return (
    <ActionForm action={startImpersonationAction} className="grid gap-3">
      <input type="hidden" name="orgId" value={orgId} />
      <Field name="reason" label="Motivo" placeholder="Ticket #482: el cliente no ve sus alertas" />
      <SubmitButton variant="outline" className="justify-self-start">
        <Eye /> Ver como la empresa
      </SubmitButton>
    </ActionForm>
  );
}

export function StatusForm({ orgId, suspended }: { orgId: string; suspended: boolean }) {
  return (
    <ActionForm action={setOrgStatusAction} className="grid gap-3">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
      {!suspended && <Field name="reason" label="Motivo" placeholder="Falta de pago reiterada" />}
      <SubmitButton variant={suspended ? "default" : "destructive"} className="justify-self-start">
        {suspended ? "Reactivar" : "Suspender"}
      </SubmitButton>
    </ActionForm>
  );
}

export function PlanForm({ orgId, planId, plans }: { orgId: string; planId: string; plans: { value: string; label: string }[] }) {
  return (
    <ActionForm action={changeOrgPlanAction} className="flex items-end gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <SelectField name="planId" label="Plan asignado" options={plans} defaultValue={planId} className="flex-1" />
      <SubmitButton variant="secondary">Asignar</SubmitButton>
    </ActionForm>
  );
}

export function SubscriptionForm({ orgId, status }: { orgId: string; status: string }) {
  return (
    <ActionForm action={setSubscriptionStatusAction} className="flex items-end gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <SelectField
        name="status"
        label="Estado de la suscripción"
        defaultValue={status}
        className="flex-1"
        options={[
          { value: "trialing", label: "En prueba" },
          { value: "active", label: "Activa" },
          { value: "past_due", label: "Pago pendiente" },
          { value: "canceled", label: "Cancelada" },
          { value: "suspended", label: "Suspendida" },
        ]}
      />
      <SubmitButton variant="secondary">Aplicar</SubmitButton>
    </ActionForm>
  );
}
