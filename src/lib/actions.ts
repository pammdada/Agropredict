import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/context";
import { EntitlementError } from "@/lib/billing/entitlements";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; data?: Record<string, string> } | undefined;

/** Maps expected failures (validation, permissions, plan limits) to a form state; re-throws redirects. */
export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return { error: "Revisa los campos marcados.", fieldErrors };
    }
    if (err instanceof ForbiddenError || err instanceof EntitlementError || err instanceof UserError) return { error: err.message };
    console.error(err);
    return { error: "Ocurrió un error inesperado. Inténtalo nuevamente." };
  }
}

export class UserError extends Error {}

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}
