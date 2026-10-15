"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand";
import { completeOAuthAction } from "@/app/(auth)/actions";

function Callback() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError(params.get("error_description") ?? "Faltan parámetros en la respuesta del proveedor.");
      return;
    }
    completeOAuthAction(code, state).then((res) => {
      if (res?.error) setError(res.error);
    });
  }, [params]);

  return error ? (
    <div className="text-center">
      <ShieldAlert className="mx-auto size-10 text-destructive" />
      <h1 className="mt-4 text-2xl font-semibold">No pudimos completar el ingreso</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Volver a ingresar
      </Link>
    </div>
  ) : (
    <div className="text-center" role="status" aria-live="polite">
      <Loader2 className="mx-auto size-10 animate-spin text-primary" />
      <h1 className="mt-4 text-2xl font-semibold">Validando tu identidad…</h1>
      <p className="mt-2 text-sm text-muted-foreground">Intercambiando el código de autorización y verificando el estado de la solicitud.</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-4">
      <Logo />
      <Suspense>
        <Callback />
      </Suspense>
    </div>
  );
}
