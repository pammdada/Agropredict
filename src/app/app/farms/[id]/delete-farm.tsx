"use client";

import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteFarmAction } from "../../actions";

export function DeleteFarmButton({ id, name }: { id: string; name: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" className="justify-self-start" />}>
        <Trash2 /> Eliminar fundo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar {name}?</DialogTitle>
          <DialogDescription>El fundo dejará de aparecer en el portal. Sus simulaciones y decisiones se conservan para auditoría.</DialogDescription>
        </DialogHeader>
        <ActionForm action={deleteFarmAction}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancelar</DialogClose>
            <SubmitButton variant="destructive">Eliminar</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
