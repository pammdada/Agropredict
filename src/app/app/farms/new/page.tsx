import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/auth/context";
import { getCatalogOptions } from "@/lib/queries";
import { FarmForm } from "../farm-form";

export const metadata: Metadata = { title: "Nuevo fundo" };

export default async function NewFarmPage() {
  await requireOrgContext("farm:write");
  const { crops, zones } = await getCatalogOptions();
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow={
          <Link href="/app/farms" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Fundos
          </Link>
        }
        title="Nuevo fundo"
        description="Los límites de fundos y hectáreas dependen de tu plan."
      />
      <Card>
        <CardContent>
          <FarmForm
            crops={crops.map((c) => ({ value: c.id, label: c.name }))}
            zones={zones.map((z) => ({ value: z.id, label: `${z.name} (${z.region})` }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
