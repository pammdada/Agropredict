import Link from "next/link";
import { Snowflake, Sprout } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLIMATE_LABELS, type SimulationInput, type SimulationResult } from "@/lib/simulation/contract";
import { fmtDate, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./page";

type Row = { sim: { id: string; name: string; type: "YIELD" | "COLD_CHAIN"; input: unknown; result: unknown; createdAt: Date }; farmName: string; userName: string };

export function riskTone(type: "YIELD" | "COLD_CHAIN", r: SimulationResult) {
  const c = r.scenarios[1];
  if (type === "YIELD") return c.deltaPct <= -15 ? "bad" : c.deltaPct <= -5 ? "warn" : "good";
  return c.value >= 3 ? "bad" : c.value >= 2.2 ? "warn" : "good";
}

export function SimulationsTable({ rows, compact = false }: { rows: Row[]; compact?: boolean }) {
  if (rows.length === 0) return <EmptyState title="Sin simulaciones todavía" description="Corre una simulación para ver aquí su resultado." />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Simulación</TableHead>
            {!compact && <TableHead>Fundo</TableHead>}
            <TableHead>Escenario</TableHead>
            <TableHead className="text-right">Central</TableHead>
            {!compact && <TableHead>Autor</TableHead>}
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ sim, farmName, userName }) => {
            const r = sim.result as SimulationResult;
            const input = sim.input as SimulationInput;
            const tone = riskTone(sim.type, r);
            const c = r.scenarios[1];
            return (
              <TableRow key={sim.id}>
                <TableCell className="max-w-72">
                  <Link href={`/app/simulations/${sim.id}`} className="flex items-center gap-2 font-medium hover:text-primary hover:underline">
                    {sim.type === "YIELD" ? <Sprout className="size-4 shrink-0 text-primary" /> : <Snowflake className="size-4 shrink-0 text-chart-4" />}
                    <span className="truncate">{sim.name}</span>
                  </Link>
                </TableCell>
                {!compact && <TableCell>{farmName}</TableCell>}
                <TableCell>{CLIMATE_LABELS[input.climate]}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    tone === "bad" && "text-critical",
                    tone === "warn" && "text-[oklch(0.55_0.13_65)]",
                    tone === "good" && "text-success",
                  )}
                >
                  {sim.type === "YIELD" ? `${fmtNum(c.value)} t/ha (${fmtNum(c.deltaPct)} %)` : `${fmtNum(c.value, 2)} % merma`}
                </TableCell>
                {!compact && <TableCell className="text-muted-foreground">{userName}</TableCell>}
                <TableCell className="text-muted-foreground">{fmtDate(sim.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
