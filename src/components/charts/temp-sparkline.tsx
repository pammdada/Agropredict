"use client";

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

/** Reefer temperature over time, one series per small multiple, with the alert threshold as a reference line. */
export function TempSparkline({ readings, threshold }: { readings: { t: string; c: number }[]; threshold: number }) {
  if (readings.length === 0) return <p className="grid h-24 place-items-center text-xs text-muted-foreground">Sin lecturas: el envío aún no sale del packing.</p>;
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer>
        <LineChart data={readings} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[-1, 6]} width={26} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} ticks={[0, 2, 4, 6]} />
          <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="4 3" label={{ value: `${threshold} °C`, position: "insideTopRight", fill: "var(--critical)", fontSize: 10 }} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { t: string; c: number };
              return (
                <div className="rounded-md bg-popover px-2 py-1 text-xs shadow-md ring-1 ring-foreground/10">
                  {time(p.t)} · <strong className="tabular-nums">{p.c.toLocaleString("es-PE")} °C</strong>
                </div>
              );
            }}
          />
          <Line dataKey="c" stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
