"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { formObject, runAction, UserError, type ActionState } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/context";
import { getPaymentProvider, signWebhook, type ChargeMethod } from "@/lib/billing/provider";
import { createInvoice, downgradeBlockers, settlePayment } from "@/lib/billing/service";
import { randomToken } from "@/lib/tokens";

export async function checkoutAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("billing:manage");
    const raw = formObject(formData);
    const planCode = z.string().parse(raw.plan);
    const db = await getDb();
    const [plan] = await db.select().from(schema.plans).where(and(eq(schema.plans.code, planCode), eq(schema.plans.active, true)));
    if (!plan) throw new UserError("El plan no está disponible.");
    const blockers = await downgradeBlockers(ctx.org.id, plan);
    if (blockers.length) throw new UserError(`No puedes cambiar al plan ${plan.name}: ${blockers.join("; ")}.`);

    let method: ChargeMethod;
    if (raw.method === "yape") {
      const y = z
        .object({
          phone: z.string().regex(/^9\d{8}$/, "Ingresa un celular de 9 dígitos que empiece con 9."),
          approvalCode: z.string().regex(/^\d{6}$/, "El código de aprobación tiene 6 dígitos."),
        })
        .parse(raw);
      method = { kind: "yape", ...y };
    } else {
      const c = z
        .object({
          holder: z.string().trim().min(3, "Ingresa el nombre del titular."),
          number: z.string().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{16}$/, "La tarjeta debe tener 16 dígitos.")),
          expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Formato MM/AA."),
          cvv: z.string().regex(/^\d{3,4}$/, "CVV inválido."),
        })
        .parse(raw);
      method = { kind: "card", ...c };
    }

    const provider = getPaymentProvider();
    const invoice = await createInvoice(ctx.org.id, plan);
    const { checkoutId } = await provider.createCheckout({ orgId: ctx.org.id, planCode: plan.code, amountCents: invoice.totalCents, currency: "PEN" });
    const result = await provider.charge(checkoutId, invoice.totalCents, method);
    await db.insert(schema.payments).values({
      orgId: ctx.org.id,
      invoiceId: invoice.id,
      provider: provider.name,
      method: method.kind,
      amountCents: invoice.totalCents,
      status: "pending",
      providerRef: result.providerRef,
      detail: result.detail,
    });
    await audit({ action: "billing.checkout", orgId: ctx.org.id, actorUserId: ctx.user.id, target: invoice.number, metadata: { plan: plan.code, method: method.kind, result: result.status } });

    if (result.status === "pending") {
      redirect(`/app/billing?pending=${invoice.number}`);
    }
    await settlePayment(result.providerRef, result.status, result.failureReason);
    if (result.status === "rejected") return { error: `Pago rechazado: ${result.failureReason} No se realizó ningún cargo.` };
    redirect(`/app/billing?paid=${invoice.number}`);
  });
}

/** Demo helper: asks the simulated provider to deliver its signed webhook for a pending payment. */
export async function simulateWebhookAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await authorize("billing:manage");
    const input = z.object({ paymentId: z.string().uuid(), outcome: z.enum(["payment.succeeded", "payment.failed"]) }).parse(formObject(formData));
    const db = await getDb();
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.id, input.paymentId), eq(schema.payments.orgId, ctx.org.id)));
    if (!payment || payment.status !== "pending") throw new UserError("El pago ya no está pendiente.");
    const body = JSON.stringify({
      id: `evt_${randomToken(10)}`,
      type: input.outcome,
      providerRef: payment.providerRef,
      reason: input.outcome === "payment.failed" ? "El titular no confirmó el pago." : undefined,
    });
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const res = await fetch(`${proto}://${host}/api/webhooks/payments/${payment.provider}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": signWebhook(body) },
      body,
    });
    if (!res.ok) throw new UserError(`El webhook respondió ${res.status}.`);
    revalidatePath("/app", "layout");
    return { ok: true, message: input.outcome === "payment.succeeded" ? "Webhook recibido: pago confirmado." : "Webhook recibido: pago fallido." };
  });
}
