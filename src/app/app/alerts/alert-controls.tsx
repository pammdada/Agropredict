"use client";

import { Check, CheckCheck, RotateCcw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SeverityBadge } from "@/components/page";
import { Input } from "@/components/ui/input";
import { setAlertStatusAction, updateAlertRuleAction } from "../actions";

function StatusButton({ id, status, label, icon }: { id: string; status: string; label: string; icon: React.ReactNode }) {
  return (
    <ActionForm action={setAlertStatusAction} showAlert={false}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant="outline" size="sm">
        {icon} {label}
      </SubmitButton>
    </ActionForm>
  );
}

export function AlertActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex shrink-0 gap-2">
      {status === "open" && <StatusButton id={id} status="acknowledged" label="Reconocer" icon={<Check />} />}
      {status !== "resolved" && <StatusButton id={id} status="resolved" label="Resolver" icon={<CheckCheck />} />}
      {status === "resolved" && <StatusButton id={id} status="open" label="Reabrir" icon={<RotateCcw />} />}
    </div>
  );
}

export function RuleRow({
  rule,
  metricLabel,
  editable,
}: {
  rule: { id: string; name: string; threshold: number; enabled: boolean; severity: "critica" | "alta" | "media" };
  metricLabel: string;
  editable: boolean;
}) {
  return (
    <li className="py-3">
      <ActionForm action={updateAlertRuleAction} successToast="Regla actualizada" className="grid gap-2">
        <input type="hidden" name="id" value={rule.id} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{rule.name}</p>
          <SeverityBadge level={rule.severity} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`t-${rule.id}`} className="flex-1 text-xs text-muted-foreground">
            {metricLabel}
          </label>
          <Input id={`t-${rule.id}`} name="threshold" type="number" step="0.5" defaultValue={rule.threshold} disabled={!editable} className="h-8 w-20 text-right" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="enabled" defaultChecked={rule.enabled} disabled={!editable} className="size-4 accent-[var(--primary)]" /> Activa
          </label>
          {editable && (
            <SubmitButton size="xs" variant="secondary">
              Guardar
            </SubmitButton>
          )}
        </div>
      </ActionForm>
    </li>
  );
}
