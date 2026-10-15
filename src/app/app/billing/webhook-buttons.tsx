"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { simulateWebhookAction } from "./actions";

export function WebhookButtons({ paymentId }: { paymentId: string }) {
  return (
    <div className="flex gap-2">
      {(["payment.succeeded", "payment.failed"] as const).map((outcome) => (
        <ActionForm key={outcome} action={simulateWebhookAction} showAlert={false} successToast={outcome === "payment.succeeded" ? "Pago confirmado por webhook" : "Pago marcado como fallido"}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="outcome" value={outcome} />
          <SubmitButton size="sm" variant={outcome === "payment.succeeded" ? "default" : "outline"}>
            {outcome === "payment.succeeded" ? "Simular confirmación" : "Simular rechazo"}
          </SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}
