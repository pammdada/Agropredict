import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getPaymentProvider, InvalidSignatureError } from "@/lib/billing/provider";
import { settlePayment } from "@/lib/billing/service";

// POST /api/webhooks/payments/{provider}: HMAC-signed, idempotent by event id.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  let provider;
  try {
    provider = getPaymentProvider(name);
  } catch {
    return NextResponse.json({ type: "about:blank", title: "Proveedor desconocido", status: 404 }, { status: 404, headers: { "content-type": "application/problem+json" } });
  }

  const raw = await req.text();
  let event;
  try {
    event = provider.parseWebhook(raw, req.headers.get("x-signature"));
  } catch (err) {
    const status = err instanceof InvalidSignatureError ? 401 : 400;
    return NextResponse.json(
      { type: "about:blank", title: err instanceof Error ? err.message : "Evento inválido", status },
      { status, headers: { "content-type": "application/problem+json" } },
    );
  }

  const db = await getDb();
  const inserted = await db
    .insert(schema.paymentEvents)
    .values({ provider: name, eventId: event.id, type: event.type, payload: event })
    .onConflictDoNothing({ target: schema.paymentEvents.eventId })
    .returning();
  if (inserted.length === 0) return NextResponse.json({ received: true, duplicate: true });

  await settlePayment(event.providerRef, event.type === "payment.succeeded" ? "approved" : "rejected", event.reason);
  return NextResponse.json({ received: true });
}
