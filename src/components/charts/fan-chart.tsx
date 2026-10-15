"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { period: string; optimistic: number; central: number; pessimistic: number };

const nf = (n: number, d: number) => n.toLocaleString("es-PE", { maximumFractionDigits: d });

/**
 * Fan chart: one hue. The band spans pessimistic..optimistic, the line is the central scenario.
 * Identity never relies on colour alone: the tooltip names every value.
 */
export function FanChart({ data, unit, digits = 0, higherIsBetter = true }: { data: Point[]; unit: string; digits?: number; higherIsBetter?: boolean }) {
  const rows = data.map((d) => ({ ...d, band: [Math.min(d.pessimistic, d.optimistic), Math.max(d.pessimistic, d.optimistic)] as [number, number] }));
  return (
    <figure>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(v: number) => nf(v, digits)}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                const items: [string, number][] = [
                  [higherIsBetter ? "Optimista" : "Optimista (menor merma)", p.optimistic],
                  ["Central", p.central],
                  ["Pesimista", p.pessimistic],
                ];
                return (
                  <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                    <p className="mb-1 font-semibold">{label}</p>
                    {items.map(([k, v]) => (
                      <p key={k} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium tabular-nums">
                          {nf(v, digits)} {unit}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill="var(--chart-1)" fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
            <Line dataKey="central" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-chart-1" /> Escenario central
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-chart-1/20" /> Rango pesimista – optimista
        </span>
      </figcaption>
    </figure>
  );
}
