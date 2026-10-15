"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { savePlanAction } from "../actions";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  sortOrder: number;
  highlighted: boolean;
  active: boolean;
  maxFarms: number;
  maxHectares: number;
  maxUsers: number;
  maxSimulationsPerMonth: number;
  coldChain: boolean;
  scenarioCompare: boolean;
};

function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-[var(--primary)]" /> {label}
    </label>
  );
}

export function PlanDialog({ plan }: { plan?: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={plan ? <Button variant="outline" size="sm" /> : <Button />}>
        {plan ? (
          <>
            <Pencil /> Editar
          </>
        ) : (
          <>
            <Plus /> Nuevo plan
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Editar plan ${plan.name}` : "Nuevo plan"}</DialogTitle>
          <DialogDescription>Usa −1 para “ilimitado”. El precio es mensual, en soles y sin IGV.</DialogDescription>
        </DialogHeader>
        <ActionForm action={savePlanAction} className="grid gap-3 sm:grid-cols-2" successToast="Plan guardado" onSuccess={() => setOpen(false)}>
          {plan && <input type="hidden" name="id" value={plan.id} />}
          <Field name="name" label="Nombre" defaultValue={plan?.name} />
          <Field name="code" label="Código" defaultValue={plan?.code} placeholder="empresarial" />
          <Field name="description" label="Descripción" defaultValue={plan?.description} className="sm:col-span-2" />
          <Field name="price" label="Precio mensual (S/)" type="number" step="0.01" defaultValue={plan?.price} />
          <Field name="sortOrder" label="Orden" type="number" defaultValue={plan?.sortOrder ?? 9} />
          <Field name="maxFarms" label="Máx. fundos" type="number" defaultValue={plan?.maxFarms ?? 5} />
          <Field name="maxHectares" label="Máx. hectáreas" type="number" defaultValue={plan?.maxHectares ?? 500} />
          <Field name="maxUsers" label="Máx. usuarios" type="number" defaultValue={plan?.maxUsers ?? 5} />
          <Field name="maxSimulationsPerMonth" label="Simulaciones/mes" type="number" defaultValue={plan?.maxSimulationsPerMonth ?? 50} />
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <Check name="coldChain" label="Cadena de frío" checked={plan?.coldChain} />
            <Check name="scenarioCompare" label="Comparador de escenarios" checked={plan?.scenarioCompare} />
            <Check name="highlighted" label="Destacar en precios" checked={plan?.highlighted} />
            <Check name="active" label="Disponible para contratar" checked={plan?.active ?? true} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Guardar plan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
