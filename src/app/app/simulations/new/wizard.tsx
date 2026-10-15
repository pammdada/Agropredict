"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CloudSun, Lock, Snowflake, Sprout } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLIMATE_LABELS, type ClimateScenario, type SimulationKind } from "@/lib/simulation/contract";
import { cn } from "@/lib/utils";
import { runSimulationAction } from "../../actions";

type Opt = { id: string; label: string; detail: string };

const CLIMATES: { key: ClimateScenario; detail: string }[] = [
  { key: "neutral", detail: "Condiciones dentro de lo normal (anomalía 0 °C)." },
  { key: "nino_moderate", detail: "Anomalía del mar de ~+1,3 °C frente a la costa." },
  { key: "nino_strong", detail: "Anomalía de ~+2,6 °C, como 1997-98 o 2017." },
  { key: "custom", detail: "Define tu propio índice de anomalía (−3 a +3 °C)." },
];

const STEPS = ["Qué simular", "Escenario", "Confirmar"];

function Choice({ selected, onClick, disabled, children }: { selected: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-secondary ring-2 ring-primary/20" : "hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      {children}
    </button>
  );
}

export function Wizard({
  farms,
  corridors,
  coldChainEnabled,
  defaultFarm,
  defaultType,
}: {
  farms: (Opt & { historyYears: number })[];
  corridors: Opt[];
  coldChainEnabled: boolean;
  defaultFarm?: string;
  defaultType: SimulationKind;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<SimulationKind>(defaultType === "COLD_CHAIN" && coldChainEnabled ? "COLD_CHAIN" : "YIELD");
  const [farmId, setFarmId] = useState(farms.find((f) => f.id === defaultFarm)?.id ?? farms[0].id);
  const [corridorId, setCorridorId] = useState(corridors[0]?.id ?? "");
  const [climate, setClimate] = useState<ClimateScenario>("nino_moderate");
  const [anomaly, setAnomaly] = useState(1.5);
  const [campaign, setCampaign] = useState("2026-2027");
  const [horizon, setHorizon] = useState(6);
  const [name, setName] = useState("");

  const farm = farms.find((f) => f.id === farmId)!;
  const corridor = corridors.find((c) => c.id === corridorId);
  const horizonOptions = type === "YIELD" ? [3, 4, 5, 6, 8, 10, 12] : [3, 5, 7, 10, 14];

  const changeType = (t: SimulationKind) => {
    setType(t);
    setHorizon(t === "YIELD" ? 6 : 7);
  };

  return (
    <div>
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-2">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span className={cn("text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="grid gap-6">
          {step === 0 && (
            <>
              <fieldset className="grid gap-3">
                <legend className="mb-3 font-semibold">Tipo de simulación</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice selected={type === "YIELD"} onClick={() => changeType("YIELD")}>
                    <Sprout className="mt-0.5 size-5 text-primary" />
                    <span>
                      <span className="block font-medium">Rendimiento (YIELD)</span>
                      <span className="text-sm text-muted-foreground">Volumen exportable t/ha por campaña. Horizonte en meses.</span>
                    </span>
                  </Choice>
                  <Choice selected={type === "COLD_CHAIN"} onClick={() => changeType("COLD_CHAIN")} disabled={!coldChainEnabled}>
                    <Snowflake className="mt-0.5 size-5 text-chart-4" />
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        Cadena de frío {!coldChainEnabled && <Lock className="size-3.5" />}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {coldChainEnabled ? "Merma % por envío y tramo. Horizonte en días." : "Disponible en el plan Pro."}
                      </span>
                    </span>
                  </Choice>
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="farm">Fundo</Label>
                  <NativeSelect id="farm" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">{farm.detail}</p>
                </div>
                {type === "COLD_CHAIN" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="corridor">Corredor logístico</Label>
                    <NativeSelect id="corridor" value={corridorId} onChange={(e) => setCorridorId(e.target.value)}>
                      {corridors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">{corridor?.detail}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <fieldset className="grid gap-3">
                <legend className="mb-3 flex items-center gap-2 font-semibold">
                  <CloudSun className="size-5 text-primary" /> Escenario climático
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CLIMATES.map((c) => (
                    <Choice key={c.key} selected={climate === c.key} onClick={() => setClimate(c.key)}>
                      <span
                        className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", {
                          "bg-success": c.key === "neutral",
                          "bg-warning": c.key === "nino_moderate",
                          "bg-critical": c.key === "nino_strong",
                          "bg-chart-4": c.key === "custom",
                        })}
                      />
                      <span>
                        <span className="block font-medium">{CLIMATE_LABELS[c.key]}</span>
                        <span className="text-sm text-muted-foreground">{c.detail}</span>
                      </span>
                    </Choice>
                  ))}
                </div>
              </fieldset>
              {climate === "custom" && (
                <div className="grid gap-2">
                  <Label htmlFor="anomaly">
                    Índice de anomalía: <strong className="tabular-nums">{anomaly > 0 ? "+" : ""}{anomaly.toFixed(1)} °C</strong>
                  </Label>
                  <input
                    id="anomaly"
                    type="range"
                    min={-3}
                    max={3}
                    step={0.1}
                    value={anomaly}
                    onChange={(e) => setAnomaly(Number(e.target.value))}
                    className="accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>−3 °C (La Niña)</span>
                    <span>+3 °C (Niño extremo)</span>
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="campaign">Campaña</Label>
                  <NativeSelect id="campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
                    {["2026-2027", "2027-2028"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="horizon">Horizonte ({type === "YIELD" ? "meses" : "días"})</Label>
                  <NativeSelect id="horizon" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                    {horizonOptions.map((h) => (
                      <option key={h} value={h}>
                        {h} {type === "YIELD" ? "meses" : "días"}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
                {[
                  ["Tipo", type === "YIELD" ? "Rendimiento (t/ha exportables)" : "Cadena de frío (merma %)"],
                  ["Fundo", `${farm.label} · ${farm.detail}`],
                  ...(type === "COLD_CHAIN" ? [["Corredor", corridor?.label ?? "—"]] : []),
                  ["Escenario", climate === "custom" ? `Personalizado (${anomaly > 0 ? "+" : ""}${anomaly.toFixed(1)} °C)` : CLIMATE_LABELS[climate]],
                  ["Campaña", campaign],
                  ["Horizonte", `${horizon} ${type === "YIELD" ? "meses" : "días"}`],
                  ["Confianza esperada", farm.historyYears >= 6 ? "Alta" : farm.historyYears >= 3 ? "Media" : "Baja"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-1.5">
                <Label htmlFor="sim-name">Nombre (opcional)</Label>
                <Input id="sim-name" className="h-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Se genera automáticamente si lo dejas vacío" />
              </div>
              <p className="text-xs text-muted-foreground">
                El motor demo v0 es determinista: con los mismos parámetros obtendrás el mismo resultado. El resultado se rotulará como “Datos demo”.
              </p>
            </>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              <ArrowLeft /> Atrás
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Siguiente <ArrowRight />
              </Button>
            ) : (
              <ActionForm action={runSimulationAction} showAlert={false}>
                {({ state }) => (
                  <div className="flex flex-col items-end gap-2">
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="farmId" value={farmId} />
                    {type === "COLD_CHAIN" && <input type="hidden" name="corridorId" value={corridorId} />}
                    <input type="hidden" name="campaign" value={campaign} />
                    <input type="hidden" name="climate" value={climate} />
                    {climate === "custom" && <input type="hidden" name="anomalyIndex" value={anomaly} />}
                    <input type="hidden" name="horizon" value={horizon} />
                    <input type="hidden" name="name" value={name} />
                    <SubmitButton>
                      <Check /> Correr simulación
                    </SubmitButton>
                    {state?.error && (
                      <p role="alert" className="max-w-sm text-right text-sm text-destructive">
                        {state.error}
                      </p>
                    )}
                  </div>
                )}
              </ActionForm>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
