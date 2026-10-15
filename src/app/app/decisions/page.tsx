import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { CalendarClock, ClipboardCheck, UserRound } from "lucide-react";
import { getDb, schema } from "@/db";
import type { DecisionStatus } from "@/db/schema";
import { EmptyState, PageHeader, SeverityBadge } from "@/components/page";
import { requireOrgContext } from "@/lib/auth/context";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EditDecision } from "./edit-decision";

export const metadata: Metadata = { title: "Decisiones" };

const COLUMNS: { key: DecisionStatus; label: string; dot: string }[] = [
  { key: "planned", label: "Planificadas", dot: "bg-chart-4" },
  { key: "in_progress", label: "En curso", dot: "bg-warning" },
  { key: "done", label: "Completadas", dot: "bg-success" },
  { key: "discarded", label: "Descartadas", dot: "bg-muted-foreground" },
];

export default async function DecisionsPage() {
  const ctx = await requireOrgContext("decision:read");
  const db = await getDb();
  const rows = await db
    .select({ d: schema.decisions, simName: schema.simulations.name, author: schema.users.name })
    .from(schema.decisions)
    .leftJoin(schema.simulations, eq(schema.simulations.id, schema.decisions.simulationId))
    .innerJoin(schema.users, eq(schema.users.id, schema.decisions.createdBy))
    .where(and(eq(schema.decisions.orgId, ctx.org.id), isNull(schema.decisions.deletedAt)))
    .orderBy(desc(schema.decisions.createdAt));
  const now = Date.now();

  return (
    <>
      <PageHeader title="Decisiones" description="Acciones recomendadas convertidas en compromisos con responsable, fecha y seguimiento." />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck />}
          title="Aún no hay decisiones registradas"
          description="Abre el resultado de una simulación y registra una acción recomendada con un clic."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = rows.filter((r) => r.d.status === col.key);
            return (
              <section key={col.key} aria-labelledby={`col-${col.key}`} className="rounded-xl bg-muted/50 p-3">
                <h2 id={`col-${col.key}`} className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
                  <span className={cn("size-2 rounded-full", col.dot)} aria-hidden />
                  {col.label}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length}</span>
                </h2>
                <ul className="grid gap-3">
                  {items.map(({ d, simName, author }) => {
                    const overdue = d.dueDate && d.dueDate.getTime() < now && (d.status === "planned" || d.status === "in_progress");
                    return (
                      <li key={d.id} className="rounded-lg bg-card p-3 shadow-xs ring-1 ring-foreground/10">
                        <div className="flex items-start justify-between gap-2">
                          <SeverityBadge level={d.priority} />
                          {ctx.can("decision:write") && (
                            <EditDecision
                              decision={{
                                id: d.id,
                                title: d.title,
                                status: d.status,
                                owner: d.owner ?? "",
                                dueDate: d.dueDate ? d.dueDate.toISOString().slice(0, 10) : "",
                                notes: d.notes ?? "",
                              }}
                            />
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium">{d.title}</p>
                        {d.detail && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.detail}</p>}
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <UserRound className="size-3.5" /> {d.owner ?? "Sin responsable"}
                          </span>
                          <span className={cn("flex items-center gap-1.5", overdue && "font-semibold text-critical")}>
                            <CalendarClock className="size-3.5" /> {d.dueDate ? `${overdue ? "Vencida · " : ""}${fmtDate(d.dueDate)}` : "Sin fecha"}
                          </span>
                        </div>
                        {d.simulationId && (
                          <Link href={`/app/simulations/${d.simulationId}`} className="mt-2 block truncate text-xs text-primary hover:underline">
                            ↳ {simName}
                          </Link>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">Registrada por {author}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
