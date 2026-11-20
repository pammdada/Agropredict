"""
01_generar_dataset.py  —  AgroPredic APF3
Genera el dataset SINTÉTICO de referencia (uva de mesa, Valle de Ica).

POR QUÉ SINTÉTICO: el acceso a series reales de SENAMHI / historial de fundos está
pendiente (riesgo R1 del APF2, trámite TUSNE). Este script produce datos con la misma
ESTRUCTURA y formato que los reales para construir y validar el pipeline (ETL, EDA,
modelado). Los resultados de modelado sobre estos datos NO son evidencia agronómica.

Salidas (data/raw/, con fallas inyectadas a propósito para probar el ETL):
  - oni_djf.csv                    ONI estacional aproximado (NOAA CPC), redondeado
  - clima_ica_mensual_raw.csv      estación de referencia sintética, formato tipo SENAMHI
  - rendimiento_fundos_raw.csv     panel fundo x campaña, formato tipo CSV del cliente
  - generacion_parametros.json     parámetros del proceso generador (trazabilidad)
"""
import json
import numpy as np
import pandas as pd
from config import RAW, SEED, PRIMER_ANIO, ULTIMO_MES

rng = np.random.default_rng(SEED)

# ---------------------------------------------------------------- 1. ONI (DJF)
# Valores aproximados y redondeados del ONI de diciembre-febrero (NOAA CPC).
# DEBEN verificarse contra la serie oficial antes del Proyecto Final. El 2026 es provisional.
ONI_DJF = {1999: -1.5, 2000: -1.6, 2001: -0.7, 2002: -0.1, 2003: 0.9, 2004: 0.4, 2005: 0.6,
           2006: -0.9, 2007: 0.7, 2008: -1.6, 2009: -0.8, 2010: 1.5, 2011: -1.4, 2012: -0.9,
           2013: -0.4, 2014: -0.4, 2015: 0.5, 2016: 2.5, 2017: -0.3, 2018: -0.9, 2019: 0.8,
           2020: 0.5, 2021: -1.0, 2022: -1.0, 2023: -0.7, 2024: 1.8, 2025: -0.6, 2026: -0.3}
pd.DataFrame({"anio_djf": list(ONI_DJF), "oni_djf": list(ONI_DJF.values())}).to_csv(RAW / "oni_djf.csv", index=False)

fechas = pd.period_range(f"{PRIMER_ANIO}-01", ULTIMO_MES, freq="M")
n = len(fechas)
mes = np.array([p.month for p in fechas]); anio = np.array([p.year for p in fechas])
# ONI mensual: interpolación lineal entre anclas DJF (15-ene de cada año)
ref = pd.Timestamp(f"{PRIMER_ANIO}-01-15")
anclas_t = np.array([(pd.Timestamp(f"{a}-01-15") - ref).days for a in ONI_DJF])
t_mes = np.array([(p.to_timestamp() + pd.Timedelta(days=14) - ref).days for p in fechas])
oni_mes = np.interp(t_mes, anclas_t, list(ONI_DJF.values()))

# ------------------------------------------------------------- 2. Clima mensual
TMAX_CLIM = np.array([31.0, 31.5, 31.0, 29.5, 27.0, 24.5, 23.5, 24.0, 25.0, 26.5, 28.0, 29.5])
TMIN_CLIM = np.array([18.5, 19.5, 19.0, 17.0, 14.5, 12.0, 11.0, 11.0, 12.0, 13.5, 15.0, 17.0])
HR_CLIM = np.array([72, 73, 72, 71, 70, 69, 68, 68, 68, 69, 70, 71], dtype=float)

# anomalía térmica local = respuesta al ONI (rezago 1 mes) + tendencia + evento costero 2017 + ruido AR(1)
oni_rez = np.r_[oni_mes[0], oni_mes[:-1]]
evento_costero = np.zeros(n)          # El Niño costero 2017 (ENFEN) con ONI neutral
for i, p in enumerate(fechas):
    if p.year == 2017 and 1 <= p.month <= 4:
        evento_costero[i] = {1: 1.4, 2: 2.0, 3: 2.2, 4: 1.2}[p.month]
ruido = np.zeros(n)
for i in range(1, n):
    ruido[i] = 0.5 * ruido[i - 1] + rng.normal(0, 0.35)
anom = 0.85 * oni_rez + 0.02 * (anio - PRIMER_ANIO) + evento_costero + ruido

tmax = TMAX_CLIM[mes - 1] + 1.0 * anom + rng.normal(0, 0.40, n)
tmin = TMIN_CLIM[mes - 1] + 0.8 * anom + rng.normal(0, 0.30, n)
hr = np.clip(HR_CLIM[mes - 1] + 3.0 * anom + rng.normal(0, 2.5, n), 40, 95)

# precipitación: cero-inflada (Ica es costa árida); lluvias en eventos fuertes / verano 2017
p_lluvia = np.where(np.isin(mes, [1, 2, 3]), 0.10, 0.03) + np.where((oni_mes >= 1.5) & np.isin(mes, [1, 2, 3]), 0.45, 0.0)
llueve = rng.random(n) < p_lluvia
precip = np.where(llueve, rng.exponential(np.where(oni_mes >= 1.5, 7.0, 1.8), n), 0.0)
for i, p in enumerate(fechas):        # picos tipo huaico 2017 (sintéticos)
    if p.year == 2017 and p.month == 2: precip[i] = max(precip[i], 14.0)
    if p.year == 2017 and p.month == 3: precip[i] = max(precip[i], 38.0)
precip = np.round(precip, 1)

clima = pd.DataFrame({"fecha": fechas.strftime("%Y-%m"), "estacion": "ICA-REF-SINT",
                      "tmax_c": np.round(tmax, 1), "tmin_c": np.round(tmin, 1),
                      "precip_mm": precip, "hr_pct": np.round(hr, 0)})

# ------------------------------------------------------------ 3. Rendimiento
cl = clima.copy()
cl["per"] = pd.PeriodIndex(cl.fecha, freq="M")
cl["tmean"] = (cl.tmax_c + cl.tmin_c) / 2
cl["m"] = mes; cl["y"] = anio
base = cl[(cl.y >= 2000) & (cl.y <= 2020)]
clim_tmax = base.groupby("m").tmax_c.mean(); clim_tmean = base.groupby("m").tmean.mean()
cl["a_tmax"] = cl.tmax_c - cl.m.map(clim_tmax); cl["a_tmean"] = cl.tmean - cl.m.map(clim_tmean)


def ventana(y0, m0, m1, col):
    """Promedio de `col` entre los meses m0 y m1 (inclusive) del año y0."""
    sel = cl[(cl.per >= pd.Period(f"{y0}-{m0:02d}")) & (cl.per <= pd.Period(f"{y0}-{m1:02d}"))]
    return sel[col].mean(), sel


VARIEDADES = {"Red Globe": 1.00, "Sweet Globe": 1.06, "Autumn Crisp": 1.02,
              "Crimson Seedless": 0.97, "Thompson Seedless": 0.94}
INICIO = [2000, 2000, 2003, 2005, 2007, 2009, 2011, 2014, 2017, 2020]   # primer año de campaña por fundo
COEF = dict(prev_verano=-0.045, floracion=-0.085, lluvia_cosecha=-0.0040, hr_floracion=-0.0040,
            enfriamiento=0.010, tendencia_anual=0.006, ruido_fundo_sd=0.045, ruido_idio_sd=0.035, ar_fundo=0.35)

filas = []
for k, y_ini in enumerate(INICIO, start=1):
    fid = f"F{k:02d}"
    var = rng.choice(list(VARIEDADES)); ha = int(rng.integers(40, 260))
    base_f = rng.normal(19.0, 1.4); ar = 0.0
    for y in range(y_ini, 2026):                      # campaña y -> y+1 (cosecha dic y - mar y+1)
        a_prev, _ = ventana(y, 1, 3, "a_tmax")        # verano previo (observado al 30-jun)
        a_flor, _ = ventana(y, 9, 11, "a_tmean")      # floración/cuajado (futuro al 30-jun)
        hr_flor, _ = ventana(y, 9, 11, "hr_pct")
        _, sel_c = ventana(y + 1, 1, 3, "precip_mm")
        lluvia = sel_c["precip_mm"].sum()
        ef = (COEF["prev_verano"] * max(a_prev, 0)
              + COEF["floracion"] * max(a_flor, 0) + COEF["enfriamiento"] * (-min(a_flor, 0))
              + COEF["lluvia_cosecha"] * min(lluvia, 30) + COEF["hr_floracion"] * max(hr_flor - 74, 0))
        ar = COEF["ar_fundo"] * ar + rng.normal(0, COEF["ruido_fundo_sd"])
        tend = 1 + COEF["tendencia_anual"] * (y - 2000)
        rend = base_f * VARIEDADES[var] * tend * (1 + ef + ar + rng.normal(0, COEF["ruido_idio_sd"]))
        filas.append({"fundo_id": fid, "variedad": var, "hectareas": ha,
                      "campana": f"{y}-{y+1}", "rendimiento_exportable_t_ha": round(rend, 2),
                      "fecha_registro": f"{y+1}-04-30"})
rend = pd.DataFrame(filas)

# ---------------------------------------------- 4. Inyección de fallas (para probar el ETL)
fallas = {}
clima_raw = clima.copy()
idx = rng.choice(n, size=8, replace=False)
clima_raw.loc[idx, "tmax_c"] = np.nan; fallas["clima_tmax_nulos"] = len(idx)
idx2 = rng.choice(np.setdiff1d(np.arange(n), idx), size=5, replace=False)
clima_raw.loc[idx2, "tmin_c"] = np.nan; fallas["clima_tmin_nulos"] = len(idx2)
idx3 = rng.choice(n, size=4, replace=False); clima_raw.loc[idx3, "precip_mm"] = -999; fallas["clima_centinela_-999"] = 4
idx4 = rng.choice(np.setdiff1d(np.arange(n), np.r_[idx, idx2]), size=3, replace=False)
clima_raw.loc[idx4, "tmax_c"] = [58.0, 61.5, 4.0]; fallas["clima_outliers_tmax"] = 3
dup = clima_raw.sample(5, random_state=SEED); clima_raw = pd.concat([clima_raw, dup]).reset_index(drop=True)
fallas["clima_filas_duplicadas"] = 5
clima_raw = clima_raw.sample(frac=1, random_state=SEED).reset_index(drop=True)

rend_raw = rend.copy()
j1 = rng.choice(len(rend_raw), size=2, replace=False); rend_raw.loc[j1, "rendimiento_exportable_t_ha"] = np.nan
fallas["rend_nulos"] = 2
j2 = rng.choice(np.setdiff1d(np.arange(len(rend_raw)), j1), size=3, replace=False)
rend_raw.loc[j2, "rendimiento_exportable_t_ha"] = (rend_raw.loc[j2, "rendimiento_exportable_t_ha"] * 1000).round(0)
fallas["rend_unidad_kg_ha"] = 3
d = rend_raw.sample(3, random_state=SEED + 1); rend_raw = pd.concat([rend_raw, d]).reset_index(drop=True)
fallas["rend_filas_duplicadas"] = 3
rend_raw["fecha_registro"] = rend_raw["fecha_registro"].astype(object)
j3 = rng.choice(len(rend_raw), size=6, replace=False)
rend_raw.loc[j3, "fecha_registro"] = pd.to_datetime(rend_raw.loc[j3, "fecha_registro"]).dt.strftime("%d/%m/%Y")
fallas["rend_fecha_formato_mixto"] = 6
j4 = rng.choice(len(rend_raw), size=4, replace=False)
rend_raw.loc[j4, "variedad"] = rend_raw.loc[j4, "variedad"].str.upper().str.replace(" ", "  ")
fallas["rend_variedad_mayus_espacios"] = 4

# verdad de terreno (SOLO para validar el ETL; en datos reales no existe)
clima.to_csv(RAW / "_verdad_terreno_clima.csv", index=False)
rend.to_csv(RAW / "_verdad_terreno_rendimiento.csv", index=False)
clima_raw.to_csv(RAW / "clima_ica_mensual_raw.csv", index=False)
rend_raw.to_csv(RAW / "rendimiento_fundos_raw.csv", index=False)
json.dump({"semilla": SEED, "periodo_clima": [fechas[0].strftime("%Y-%m"), fechas[-1].strftime("%Y-%m")],
           "fundos": len(INICIO), "inicio_por_fundo": INICIO, "coeficientes_generador": COEF,
           "multiplicador_variedad": VARIEDADES, "fallas_inyectadas": fallas,
           "nota": "Dataset sintético. Fallas inyectadas a propósito para probar el ETL."},
          open(RAW / "generacion_parametros.json", "w"), indent=2, ensure_ascii=False)
print("clima_raw:", clima_raw.shape, "| rend_raw:", rend_raw.shape)
print("fallas inyectadas:", fallas)
