"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { SelectField } from "@/components/native-select";
import { createFarmAction, updateFarmAction } from "../actions";

type Option = { value: string; label: string };
type Farm = { id: string; name: string; cropId: string; zoneId: string; variety: string | null; hectares: number; historyYears: number };

export function FarmForm({ crops, zones, farm, disabled }: { crops: Option[]; zones: Option[]; farm?: Farm; disabled?: boolean }) {
  return (
    <ActionForm action={farm ? updateFarmAction : createFarmAction} className="grid gap-4 sm:grid-cols-2">
      {farm && <input type="hidden" name="id" value={farm.id} />}
      <fieldset disabled={disabled} className="contents">
        <Field name="name" label="Nombre del fundo" defaultValue={farm?.name} className="sm:col-span-2" placeholder="Fundo Santa Rosa" />
        <SelectField name="cropId" label="Cultivo" options={crops} defaultValue={farm?.cropId} />
        <Field name="variety" label="Variedad" defaultValue={farm?.variety ?? ""} placeholder="Red Globe" />
        <SelectField name="zoneId" label="Zona" options={zones} defaultValue={farm?.zoneId} />
        <Field name="hectares" label="Hectáreas productivas" type="number" step="0.1" min="0" defaultValue={farm?.hectares} />
        <Field
          name="historyYears"
          label="Años de historial registrado"
          type="number"
          min="0"
          defaultValue={farm?.historyYears ?? 0}
          hint="Define el nivel de confianza de las simulaciones."
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <SubmitButton>{farm ? "Guardar cambios" : "Crear fundo"}</SubmitButton>
        </div>
      </fieldset>
    </ActionForm>
  );
}
