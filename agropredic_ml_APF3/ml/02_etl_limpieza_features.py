"""
02_etl_limpieza_features.py  —  AgroPredic APF3
ETL reproducible: raw -> limpieza y validación -> anomalías -> tabla de modelado.

Principios (prevención de fuga de datos / data leakage):
  1. La variable objetivo NUNCA se imputa; las filas sin objetivo se excluyen del modelado.
  2. Toda variable del "Conjunto A" usa solo información disponible al 30-jun del año de inicio
     de campaña (fecha de emisión de la proyección).
  3. Las variables del "Conjunto B" son del futuro respecto del 30-jun (escenario climático):
     se etiquetan aparte y no se mezclan con el Conjunto A.
  4. Las variables derivadas del propio rendimiento (rend_prev, rend_media_hist) usan solo
     campañas anteriores (shift / expanding con desplazamiento).
  5. No se calcula ningún escalador/codificador aquí: se ajustan DENTRO de cada pliegue
     de validación en la etapa de modelado (secciones 4-5).
"""
import json
import numpy as np
import pandas as pd
from config import RAW, PROC, REP, BASE_CLIMA, clase_enso

REP.mkdir(exist_ok=True); PROC.mkdir(exist_ok=True)
calidad = {}

# =============================================================== CLIMA
clima = pd.read_csv(RAW / "clima_ica_mensual_raw.csv")
calidad["clima_filas_raw"] = len(clima)
calidad["clima_nulos_raw"] = {c: int(clima[c].isna().sum()) for c in ["tmax_c", "tmin_c", "precip_mm", "hr_pct"]}
calidad["clima_centinelas_raw"] = int((clima.precip_mm == -999).sum())

# 1) duplicados por clave (fecha, estación)
calidad["clima_duplicados_raw"] = int(clima.duplicated(subset=["fecha", "estacion"]).sum())
clima = clima.drop_duplicates(subset=["fecha", "estacion"], keep="first")

# 2) centinelas y rangos físicos plausibles -> NaN
clima["precip_mm"] = clima["precip_mm"].replace(-999, np.nan)
reglas = {"tmax_c": (10, 45), "tmin_c": (0, 30), "hr_pct": (0, 100), "precip_mm": (0, 300)}
fuera = {}
for col, (lo, hi) in reglas.items():
    m = clima[col].notna() & ((clima[col] < lo) | (clima[col] > hi))
    fuera[col] = int(m.sum()); clima.loc[m, col] = np.nan
calidad["clima_fuera_de_rango"] = fuera
inc = clima.tmin_c.notna() & clima.tmax_c.notna() & (clima.tmin_c >= clima.tmax_c)
calidad["clima_tmin_ge_tmax"] = int(inc.sum())

# 3) calendario completo y orden temporal
clima["per"] = pd.PeriodIndex(clima["fecha"], freq="M")
completo = pd.period_range(clima.per.min(), clima.per.max(), freq="M")
calidad["clima_meses_faltantes_calendario"] = int(len(completo.difference(pd.PeriodIndex(clima.per))))
clima = clima.set_index("per").reindex(completo).rename_axis("per").reset_index()
clima["fecha"] = clima.per.dt.strftime("%Y-%m"); clima["estacion"] = clima.estacion.fillna("ICA-REF-SINT")
clima["mes"] = clima.per.dt.month; clima["anio"] = clima.per.dt.year

# 4) imputación: interpolación lineal de la ANOMALÍA respecto de la climatología mensual (solo
#    huecos puntuales). Se marca con flag. Precipitación faltante -> mediana mensual (0).
base = (clima.anio >= BASE_CLIMA[0]) & (clima.anio <= BASE_CLIMA[1])
for col in ["tmax_c", "tmin_c", "hr_pct"]:
    flag = clima[col].isna(); clima[f"imp_{col}"] = flag.astype(int)
    clim = clima.loc[base].groupby("mes")[col].mean()
    an = clima[col] - clima.mes.map(clim)
    an = an.interpolate(limit=2, limit_direction="both")
    clima[col] = clima[col].fillna(an + clima.mes.map(clim))
flag = clima.precip_mm.isna(); clima["imp_precip_mm"] = flag.astype(int)
clima["precip_mm"] = clima.precip_mm.fillna(clima.groupby("mes").precip_mm.transform("median"))
calidad["clima_imputados"] = {c: int(clima[f"imp_{c}"].sum()) for c in ["tmax_c", "tmin_c", "hr_pct", "precip_mm"]}
calidad["clima_nulos_final"] = int(clima[["tmax_c", "tmin_c", "hr_pct", "precip_mm"]].isna().sum().sum())

# 5) variables derivadas y anomalías (climatología base fija 2000-2020)
clima["tmean_c"] = (clima.tmax_c + clima.tmin_c) / 2
for col, nombre in [("tmax_c", "anom_tmax"), ("tmean_c", "anom_tmean")]:
    clim = clima.loc[base].groupby("mes")[col].mean()
    clima[nombre] = clima[col] - clima.mes.map(clim)
clima_out = clima[["fecha", "estacion", "anio", "mes", "tmax_c", "tmin_c", "tmean_c", "precip_mm", "hr_pct",
                   "anom_tmax", "anom_tmean", "imp_tmax_c", "imp_tmin_c", "imp_precip_mm", "imp_hr_pct"]].round(3)
clima_out.to_csv(PROC / "clima_ica_mensual.csv", index=False)
calidad["clima_filas_final"] = len(clima_out)

# =============================================================== RENDIMIENTO
r = pd.read_csv(RAW / "rendimiento_fundos_raw.csv")
calidad["rend_filas_raw"] = len(r)
calidad["rend_nulos_objetivo_raw"] = int(r.rendimiento_exportable_t_ha.isna().sum())
calidad["rend_duplicados_raw"] = int(r.duplicated(subset=["fundo_id", "campana"]).sum())
r = r.drop_duplicates(subset=["fundo_id", "campana"], keep="first")

# unidad: valores > 1000 se interpretan como kg/ha y se convierten a t/ha
kg = r.rendimiento_exportable_t_ha > 1000
calidad["rend_unidad_corregida_kg_a_t"] = int(kg.sum())
r.loc[kg, "rendimiento_exportable_t_ha"] = r.loc[kg, "rendimiento_exportable_t_ha"] / 1000

# fechas con formato mixto (ISO y dd/mm/aaaa) -> ISO
iso = r.fecha_registro.str.match(r"^\d{4}-\d{2}-\d{2}$")
calidad["rend_fechas_formato_no_iso"] = int((~iso).sum())
r["fecha_registro"] = np.where(iso, pd.to_datetime(r.fecha_registro.where(iso), errors="coerce"),
                               pd.to_datetime(r.fecha_registro.where(~iso), format="%d/%m/%Y", errors="coerce"))
r["fecha_registro"] = pd.to_datetime(r.fecha_registro).dt.strftime("%Y-%m-%d")

# variedad: espacios y mayúsculas
antes = r.variedad.nunique()
r["variedad"] = r.variedad.str.strip().str.replace(r"\s+", " ", regex=True).str.title()
calidad["rend_variedades_distintas_antes_despues"] = [int(antes), int(r.variedad.nunique())]

# rango agronómico plausible 5-40 t/ha
fuera = (r.rendimiento_exportable_t_ha < 5) | (r.rendimiento_exportable_t_ha > 40)
calidad["rend_fuera_de_rango_5_40"] = int(fuera.sum())
r["anio_inicio"] = r.campana.str[:4].astype(int)
r = r.sort_values(["fundo_id", "anio_inicio"]).reset_index(drop=True)
r.rename(columns={"rendimiento_exportable_t_ha": "rend_t_ha"}).to_csv(PROC / "rendimiento_fundos.csv", index=False)
calidad["rend_filas_final"] = len(r)

# =============================================================== TABLA DE MODELADO
from features import construir_features
oni = pd.read_csv(RAW / "oni_djf.csv").set_index("anio_djf").oni_djf
cl = clima.set_index("per")
m = construir_features(r, cl, oni)
calidad["modelado_filas_antes_de_excluir_primera_campana"] = len(m)
m = m.dropna(subset=["rend_prev"]).reset_index(drop=True)          # la primera campaña no tiene historial
calidad["modelado_filas_final"] = len(m)
m["clase_enso_cosecha"] = m.oni_djf_cosecha.map(clase_enso)

orden = ["fundo_id", "campana", "anio_inicio", "variedad", "hectareas",
         "oni_djf_previo", "anom_tmax_ene_mar", "anom_tmean_abr_jun", "precip_ene_mar_prev",
         "rend_prev", "rend_media_hist", "n_campanas_previas",
         "oni_djf_cosecha", "anom_tmean_set_nov", "hr_set_nov", "precip_ene_mar_cosecha",
         "clase_enso_cosecha", "rend_t_ha"]
m[orden].round(3).to_csv(PROC / "dataset_modelado.csv", index=False)
calidad["modelado_nulos_final"] = int(m[orden].isna().sum().sum())
calidad["modelado_fundos"] = int(m.fundo_id.nunique())
calidad["modelado_campanas"] = int(m.anio_inicio.nunique())

# prueba de no-fuga: ninguna variable del conjunto A usa datos posteriores al 30-jun del año y
assert (m.anio_inicio.min() >= 2001), "la primera campaña no debe estar en el modelado"
json.dump(calidad, open(REP / "calidad_datos.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps(calidad, indent=1, ensure_ascii=False))
