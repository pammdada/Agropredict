import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DEMO_ACCOUNTS } from "@/db/seed";
import { Divider, SocialButtons } from "../social-buttons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Ingresa a tu portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ¿Tu empresa aún no usa AgroPredic?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Registra tu empresa
        </Link>
      </p>
      {reset && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          <CheckCircle2 className="size-4 text-success" /> Contraseña actualizada. Ingresa con tu nueva contraseña.
        </p>
      )}
      <div className="mt-8">
        <SocialButtons />
      </div>
      <Divider />
      <LoginForm demoAccounts={DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.role }))} />
    </div>
  );
}
