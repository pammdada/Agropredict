const TZ = "America/Lima";

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }) : "—";

export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";

export const fmtNum = (n: number, digits = 1) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);

export const fmtPct = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${fmtNum(n, digits)} %`;

export function relativeTime(d: Date | string): string {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es-PE", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
