"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { SelectField } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateDecisionAction } from "../actions";

type Decision = { id: string; title: string; status: string; owner: string; dueDate: string; notes: string };

export function EditDecision({ decision }: { decision: Decision }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Editar decisión: ${decision.title}`} />}>
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seguimiento de la decisión</DialogTitle>
          <DialogDescription>{decision.title}</DialogDescription>
        </DialogHeader>
        <ActionForm action={updateDecisionAction} className="grid gap-4" successToast="Decisión actualizada" onSuccess={() => setOpen(false)}>
          <input type="hidden" name="id" value={decision.id} />
          <SelectField
            name="status"
            label="Estado"
            defaultValue={decision.status}
            options={[
              { value: "planned", label: "Planificada" },
              { value: "in_progress", label: "En curso" },
              { value: "done", label: "Completada" },
              { value: "discarded", label: "Descartada" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="owner" label="Responsable" defaultValue={decision.owner} placeholder="Área o persona" />
            <Field name="dueDate" label="Fecha límite" type="date" defaultValue={decision.dueDate} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notas de seguimiento</Label>
            <Textarea id="notes" name="notes" defaultValue={decision.notes} rows={3} />
          </div>
          <SubmitButton className="justify-self-end">Guardar</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
