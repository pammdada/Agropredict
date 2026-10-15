"use client";

import { ClipboardCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { recordDecisionAction } from "../../actions";

export function RecordDecisionButton({ simulationId, actionIndex }: { simulationId: string; actionIndex: number }) {
  return (
    <ActionForm action={recordDecisionAction} showAlert={false} successToast="Decisión registrada. Asígnale responsable en Decisiones.">
      {({ state }) => (
        <>
          <input type="hidden" name="simulationId" value={simulationId} />
          <input type="hidden" name="actionIndex" value={actionIndex} />
          <SubmitButton variant="outline" className="shrink-0">
            <ClipboardCheck /> Registrar como decisión
          </SubmitButton>
          {state?.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
        </>
      )}
    </ActionForm>
  );
}
