"use client";

import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFormCtx } from "./forms";

/** Native <select> styled like the design system: accessible and submits with plain FormData. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-input bg-background pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  className,
  hint,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
} & React.ComponentProps<"select">) {
  const { state } = useFormCtx();
  const error = state?.fieldErrors?.[name];
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <NativeSelect id={`f-${name}`} name={name} aria-invalid={error ? true : undefined} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
