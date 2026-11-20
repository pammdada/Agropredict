"""
02b_validar_etl.py — AgroPredic APF3
Prueba del ETL contra la "verdad de terreno" del generador sintético (solo posible con datos sintéticos).
Mide cuántas celdas se recuperan exactamente y el error de las imputaciones.
"""
import json
import numpy as np
import pandas as pd
from config import RAW, PROC, REP

c = pd.read_csv(PROC / "clima_ica_mensual.csv"); t = pd.read_csv(RAW / "_verdad_terreno_clima.csv")
m = c.merge(t, on="fecha", suffixes=("", "_t")); out = {}
for col in ["tmax_c", "tmin_c", "precip_mm", "hr_pct"]:
    imp = m[f"imp_{col}"] == 1
    err = (m.loc[imp, col] - m.loc[imp, f"{col}_t"]).abs()
    out[col] = {"imputados": int(imp.sum()), "MAE_imputacion": round(float(err.mean()), 2) if imp.any() else None,
                "max_error_imputacion": round(float(err.max()), 2) if imp.any() else None,
                "celdas_no_imputadas_identicas_a_verdad_pct": round(float(((m.loc[~imp, col] - m.loc[~imp, f"{col}_t"]).abs() < .06).mean() * 100), 1)}
r = pd.read_csv(PROC / "rendimiento_fundos.csv"); tr = pd.read_csv(RAW / "_verdad_terreno_rendimiento.csv")
mr = r.merge(tr, on=["fundo_id", "campana"], suffixes=("", "_t")).dropna(subset=["rend_t_ha"])
out["rendimiento"] = {"filas_comparadas": int(len(mr)),
                      "recuperadas_exactas_pct": round(float(((mr.rend_t_ha - mr.rendimiento_exportable_t_ha).abs() < .006).mean() * 100), 1),
                      "variedad_recuperada_pct": round(float((mr.variedad == mr.variedad_t).mean() * 100), 1)}
out["filas_clima_final_igual_verdad"] = bool(len(c) == len(t))
json.dump(out, open(REP / "validacion_etl.json", "w"), indent=2, ensure_ascii=False); print(json.dumps(out, indent=1, ensure_ascii=False))
