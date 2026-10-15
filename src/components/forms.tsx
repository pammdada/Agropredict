"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions";

type FormCtx = { state: ActionState; pending: boolean };
const Ctx = createContext<FormCtx>({ state: undefined, pending: false });

export function useFormCtx() {
  return useContext(Ctx);
}

/**
 * Form bound to a server action through useActionState. Submits via a transition
 * so field values survive validation errors (no automatic form reset).
 */
export function ActionForm({
  action,
  children,
  className,
  successToast,
  onSuccess,
  showAlert = true,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((ctx: FormCtx) => ReactNode);
  className?: string;
  successToast?: string;
  onSuccess?: (state: ActionState) => void;
  showAlert?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const lastHandled = useRef<ActionState>(undefined);
  useEffect(() => {
    if (state && state !== lastHandled.current && state.ok && !state.error) {
      lastHandled.current = state;
      if (successToast) toast.success(successToast);
      onSuccess?.(state);
    }
  }, [state, successToast, onSuccess]);

  return (
    <Ctx.Provider value={{ state, pending }}>
      <form
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        {showAlert && <FormAlert />}
        {typeof children === "function" ? children({ state, pending }) : children}
      </form>
    </Ctx.Provider>
  );
}

export function FormAlert() {
  const { state } = useFormCtx();
  if (!state?.error && !state?.message) return null;
  const isError = Boolean(state.error);
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "mb-4 flex gap-2 rounded-lg border px-3 py-2.5 text-sm",
        isError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-foreground",
      )}
    >
      {isError ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
      <span>{state.error ?? state.message}</span>
    </div>
  );
}

export function Field({
  name,
  label,
  hint,
  className,
  ...props
}: { name: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  const { state } = useFormCtx();
  const error = state?.fieldErrors?.[name];
  const id = `f-${name}`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} className="h-9" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...props} />
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormCtx();
  const error = state?.fieldErrors?.[name];
  return error ? <p className="text-xs text-destructive">{error}</p> : null;
}

export function SubmitButton({ children, className, disabled, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" disabled={pending || disabled} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
