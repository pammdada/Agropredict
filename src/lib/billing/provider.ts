import "server-only";
import { hmacSha256, randomToken, safeEqual } from "@/lib/tokens";

// Billing depends on this port; the adapter is chosen by configuration.

export type ChargeMethod =
  | { kind: "card"; number: string; expiry: string; cvv: string; holder: string }
  | { kind: "yape"; phone: string; approvalCode: string };

export type ChargeResult = {
  status: "approved" | "rejected" | "pending";
  providerRef: string;
  detail: string;
  failureReason?: string;
};

export type WebhookEvent = { id: string; type: "payment.succeeded" | "payment.failed"; providerRef: string; reason?: string };

export interface PaymentProvider {
  readonly name: string;
  createCustomer(org: { id: string; name: string; ruc: string | null }): Promise<{ customerId: string }>;
  createCheckout(input: { orgId: string; planCode: string; amountCents: number; currency: "PEN" }): Promise<{ checkoutId: string }>;
  charge(checkoutId: string, amountCents: number, method: ChargeMethod): Promise<ChargeResult>;
  refund(providerRef: string, amountCents: number): Promise<{ refundId: string }>;
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent;
}

export class InvalidSignatureError extends Error {}

function webhookSecret() {
  return process.env.PAYMENTS_WEBHOOK_SECRET || "dev-only-webhook-secret";
}

/** Signs a webhook body the way the provider would (HMAC-SHA256, hex). */
export function signWebhook(rawBody: string) {
  return hmacSha256(webhookSecret(), rawBody);
}

export const TEST_CARDS = [
  { number: "4111 1111 1111 1111", outcome: "approved" as const, label: "Aprobada" },
  { number: "4000 0000 0000 0002", outcome: "rejected" as const, label: "Rechazada (fondos insuficientes)" },
  { number: "4000 0000 0000 0077", outcome: "pending" as const, label: "Pendiente (confirmación por webhook)" },
];

export const YAPE_TEST_CODES = [
  { code: "123456", outcome: "approved" as const },
  { code: "000000", outcome: "rejected" as const },
];

/** MVP adapter: deterministic outcomes from published test cards and Yape-like approval codes. */
export class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated";

  async createCustomer(org: { id: string }) {
    return { customerId: `sim_cus_${org.id.slice(0, 8)}` };
  }

  async createCheckout() {
    return { checkoutId: `sim_chk_${randomToken(8)}` };
  }

  async charge(_checkoutId: string, _amountCents: number, method: ChargeMethod): Promise<ChargeResult> {
    const ref = `sim_ch_${randomToken(10)}`;
    if (method.kind === "yape") {
      const outcome = YAPE_TEST_CODES.find((c) => c.code === method.approvalCode)?.outcome ?? "rejected";
      return outcome === "approved"
        ? { status: "approved", providerRef: ref, detail: `Yape ••• ${method.phone.slice(-3)}` }
        : { status: "rejected", providerRef: ref, detail: `Yape ••• ${method.phone.slice(-3)}`, failureReason: "Código de aprobación inválido o vencido." };
    }
    const digits = method.number.replace(/\D/g, "");
    const card = TEST_CARDS.find((c) => c.number.replace(/\s/g, "") === digits);
    const detail = `Visa •••• ${digits.slice(-4)}`;
    if (!card) return { status: "rejected", providerRef: ref, detail, failureReason: "Tarjeta no válida en el entorno de pruebas. Usa una tarjeta de prueba." };
    if (card.outcome === "rejected") return { status: "rejected", providerRef: ref, detail, failureReason: "El emisor rechazó el cargo: fondos insuficientes." };
    if (card.outcome === "pending") return { status: "pending", providerRef: ref, detail };
    return { status: "approved", providerRef: ref, detail };
  }

  async refund() {
    return { refundId: `sim_re_${randomToken(8)}` };
  }

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    if (!signature || !safeEqual(signature, signWebhook(rawBody))) throw new InvalidSignatureError("Firma HMAC inválida.");
    const body = JSON.parse(rawBody) as WebhookEvent;
    if (!body.id || !body.providerRef || !["payment.succeeded", "payment.failed"].includes(body.type)) throw new Error("Evento inválido.");
    return body;
  }
}

/**
 * Skeleton for the real gateway (APF3). Only configuration and field mapping; no credentials in the repo.
 * Before integrating, confirm in Culqi's current documentation which methods (card, Yape, others) are available.
 */
export class CulqiProvider implements PaymentProvider {
  readonly name = "culqi";
  constructor(private readonly config = { publicKey: process.env.CULQI_PUBLIC_KEY, secretKey: process.env.CULQI_SECRET_KEY, apiBase: "https://api.culqi.com/v2" }) {}

  private notConfigured(): never {
    throw new Error("CulqiProvider no está configurado en el MVP.");
  }
  async createCustomer(): Promise<{ customerId: string }> {
    return this.notConfigured();
  }
  async createCheckout(): Promise<{ checkoutId: string }> {
    return this.notConfigured();
  }
  async charge(): Promise<ChargeResult> {
    return this.notConfigured();
  }
  async refund(): Promise<{ refundId: string }> {
    return this.notConfigured();
  }
  parseWebhook(): WebhookEvent {
    return this.notConfigured();
  }
}

const providers: Record<string, PaymentProvider> = { simulated: new SimulatedProvider(), culqi: new CulqiProvider() };

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER || "simulated"): PaymentProvider {
  const p = providers[name];
  if (!p) throw new Error(`Proveedor de pagos desconocido: ${name}`);
  return p;
}
