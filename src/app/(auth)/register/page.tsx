import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrar empresa" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const db = await getDb();
  const plans = await db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.sortOrder));
  return (
    <div>
      <h1 className="text-3xl font-semibold">Registra tu empresa</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Crea la organización y tu usuario administrador. Empiezas con 14 días de prueba.{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Ya tengo cuenta
        </Link>
      </p>
      <RegisterForm
        defaultPlan={plans.some((p) => p.code === plan) ? plan! : "piloto"}
        plans={plans.map((p) => ({ code: p.code, name: p.name, priceCents: p.priceCents, description: p.description }))}
      />
    </div>
  );
}
