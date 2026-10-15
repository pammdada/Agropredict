import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb, schema } from "@/db";
import { PageHeader } from "@/components/page";
import { requireOrgContext } from "@/lib/auth/context";
import { TEST_CARDS, YAPE_TEST_CODES } from "@/lib/billing/provider";
import { Checkout } from "./checkout";

export const metadata: Metadata = { title: "Cambiar plan" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const ctx = await requireOrgContext("billing:manage");
  const { plan } = await searchParams;
  const db = await getDb();
  const plans = await db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.sortOrder));
  const initial = plans.find((p) => p.code === plan) ?? plans.find((p) => p.id !== ctx.plan.id) ?? plans[0];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/app/billing" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Facturación
          </Link>
        }
        title="Cambiar plan"
        description="El cambio se aplica al confirmarse el pago e inicia un nuevo periodo de 30 días."
      />
      <Checkout
        plans={plans.map((p) => ({ code: p.code, name: p.name, description: p.description, priceCents: p.priceCents, entitlements: p.entitlements }))}
        currentCode={ctx.plan.code}
        currentStatus={ctx.subscription.status}
        initialCode={initial.code}
        testCards={TEST_CARDS}
        yapeCodes={YAPE_TEST_CODES}
      />
    </div>
  );
}
