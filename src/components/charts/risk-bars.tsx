"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { farm: string; delta: number; scenario: string };

const nf = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 });

/** Single-series bar chart: change of the central scenario vs. baseline per farm (one hue, zero baseline). */
export function RiskBars({ data }: { data: Row[] }) {
  const min = Math.min(-5, ...data.map((d) => d.delta));
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 56 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis type="number" domain={[Math.floor((min - 4) / 5) * 5, 5]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => `${v} %`} />
          <YAxis type="category" dataKey="farm" width={130} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Row;
              return (
                <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10">
                  <p className="font-semibold">{p.farm}</p>
                  <p className="text-muted-foreground">{p.scenario}</p>
                  <p className="mt-1 font-medium tabular-nums">{nf(p.delta)} % vs. campaña base</p>
                </div>
              );
            }}
          />
          <Bar dataKey="delta" fill="var(--chart-1)" radius={4} maxBarSize={22} isAnimationActive={false}>
            <LabelList
              dataKey="delta"
              content={(props) => {
                const x = Number(props.x ?? 0);
                const w = Number(props.width ?? 0);
                const y = Number(props.y ?? 0) + Number(props.height ?? 0) / 2;
                const v = Number(props.value ?? 0);
                // Label sits just beyond the bar's data end, on whichever side of zero it falls.
                const end = v < 0 ? Math.min(x, x + w) - 6 : Math.max(x, x + w) + 6;
                return (
                  <text x={end} y={y} dy={4} textAnchor={v < 0 ? "end" : "start"} fill="var(--foreground)" fontSize={12} fontWeight={600}>
                    {`${nf(v)} %`}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
