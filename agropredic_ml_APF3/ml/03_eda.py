"""
03_eda.py  —  AgroPredic APF3
Análisis exploratorio (EDA) del dataset de modelado: estadísticas, pruebas y figuras.
Todo se calcula sobre datos SINTÉTICOS; los patrones reflejan el proceso generador y
sirven para validar el método, no como hallazgo agronómico.
"""
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from scipy import stats
from config import PROC, RAW, FIG, REP, ORDEN_ENSO, SEED

FIG.mkdir(exist_ok=True)
VERDE, OCRE, ROJO, AZUL, GRIS = "#2E7D32", "#C77D1A", "#B23A3A", "#2F5D8A", "#6B7280"
COL_ENSO = {"Neutro/Niña": AZUL, "Niño débil": OCRE, "Niño moderado/fuerte": ROJO}
plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.titlesize": 9.5, "axes.titleweight": "bold", "figure.dpi": 200,
                     "savefig.bbox": "tight", "axes.grid": True, "grid.alpha": .25})

d = pd.read_csv(PROC / "dataset_modelado.csv")
cl = pd.read_csv(PROC / "clima_ica_mensual.csv")
cl["per"] = pd.PeriodIndex(cl.fecha, freq="M")
oni = pd.read_csv(RAW / "oni_djf.csv")
S = {}                                                    # estadísticas para el informe

# ---- índice de rendimiento relativo (SOLO descriptivo): % respecto de la tendencia propia del fundo
def idx(g):
    b = np.polyfit(g.anio_inicio, g.rend_t_ha, 1)
    return g.rend_t_ha / np.polyval(b, g.anio_inicio) * 100
d["rend_idx"] = d.groupby("fundo_id", group_keys=False).apply(idx)

# =================================================== Fig 1: pipeline
fig, ax = plt.subplots(figsize=(6.8, 2.3)); ax.axis("off"); ax.set_xlim(0, 100); ax.set_ylim(0, 40)
cajas = [("1. Datos crudos", "CSV tipo SENAMHI\nCSV del fundo\nONI (NOAA CPC)", "#E5E7EB"),
         ("2. Limpieza", "duplicados\ncentinelas (-999)\nrangos · unidades\nfechas · texto", "#FEF3C7"),
         ("3. Imputación", "solo clima, con flag\nel objetivo NUNCA\nse imputa", "#FEF3C7"),
         ("4. Variables", "anomalías · ventanas\nConjunto A y B\nrend. previo", "#DCFCE7"),
         ("5. Dataset", "dataset_modelado.csv\n162 filas\n18 columnas", "#D1E7F5")]
for i, (tt, cu, c) in enumerate(cajas):
    x = 1 + i * 20
    ax.add_patch(FancyBboxPatch((x, 11), 16, 25, boxstyle="round,pad=0.4", fc=c, ec="#374151", lw=.8))
    ax.text(x + 8, 31.5, tt, ha="center", va="center", fontsize=6.6, fontweight="bold")
    ax.text(x + 8, 20.5, cu, ha="center", va="center", fontsize=5.9)
    if i < 4: ax.add_patch(FancyArrowPatch((x + 16.8, 23.5), (x + 19.4, 23.5), arrowstyle="-|>", mutation_scale=9, color="#374151"))
ax.text(50, 3.5, "Escaladores, codificadores e hiperparámetros se ajustan dentro de cada pliegue de validación (secciones 4 y 5).",
        ha="center", fontsize=6.4, style="italic", color=GRIS)
fig.savefig(FIG / "fig01_pipeline_datos.png"); plt.close()

# =================================================== Fig 2: línea de tiempo de disponibilidad (anti-fuga)
from matplotlib.patches import Patch
filas_t = [("ONI DJF previo", 0, 2, "A"), ("Anom. Tmax ene–mar", 0, 3, "A"), ("Precip. ene–mar previa", 0, 3, "A"),
           ("Anom. Tmean abr–jun", 3, 6, "A"), ("Anom. Tmean set–nov", 8, 11, "B"), ("HR set–nov", 8, 11, "B"),
           ("ONI DJF cosecha", 11, 14, "B"), ("Precip. ene–mar cosecha", 12, 15, "B")]
fig, ax = plt.subplots(figsize=(6.8, 3.3)); ax.set_xlim(0, 16); ax.set_ylim(-.8, len(filas_t) + .2)
ax.grid(False); ax.spines["left"].set_visible(False)
ax.axvspan(11, 15, color="#F59E0B", alpha=.13); ax.text(13, -.55, "cosecha (dic–mar)", ha="center", fontsize=6.8, color="#92400E")
for i, (n_, x0, x1, g_) in enumerate(filas_t[::-1]):
    ax.add_patch(plt.Rectangle((x0, i + .12), x1 - x0, .76, fc="#86EFAC" if g_ == "A" else "#FCA5A5", ec="#374151", lw=.6))
ax.set_yticks([i + .5 for i in range(len(filas_t))]); ax.set_yticklabels([f[0] for f in filas_t[::-1]], fontsize=7); ax.tick_params(axis="y", length=0)
ax.axvline(6, color="k", lw=1.6); ax.text(6.2, len(filas_t) - .05, "30-jun: se emite la proyección", fontsize=7, fontweight="bold", va="bottom")
meses = (["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] * 2)[:16]
ax.set_xticks(np.arange(16) + .5); ax.set_xticklabels(meses, fontsize=7); ax.tick_params(axis="x", length=0)
ax.set_xlabel("Meses: año y (enero–diciembre) y año y+1 (enero–abril)", fontsize=7.5)
ax.legend(handles=[Patch(fc="#86EFAC", ec="#374151", label="Conjunto A: observado al 30-jun (sin fuga)"),
                   Patch(fc="#FCA5A5", ec="#374151", label="Conjunto B: futuro, entra como escenario")],
          loc="upper right", frameon=True, fontsize=6.6, bbox_to_anchor=(1.0, .88))
ax.set_title("Disponibilidad temporal de las variables respecto de la fecha de pronóstico")
fig.savefig(FIG / "fig02_linea_tiempo_campana.png"); plt.close()

# =================================================== Fig 3: series ONI y anomalía térmica
oni_m = oni.set_index("anio_djf").oni_djf
fig, ax = plt.subplots(2, 1, figsize=(6.8, 4.2), sharex=True)
x = cl.per.dt.to_timestamp()
ax[0].plot(pd.to_datetime(oni.anio_djf.astype(str) + "-01-15"), oni.oni_djf, color=GRIS, marker="o", ms=3, lw=1)
ax[0].axhline(1.0, color=ROJO, ls="--", lw=.8); ax[0].axhline(0, color="k", lw=.5)
ax[0].fill_between(pd.to_datetime(oni.anio_djf.astype(str) + "-01-15"), 1.0, oni.oni_djf, where=oni.oni_djf >= 1.0, color=ROJO, alpha=.35)
for a in (2010, 2016, 2024): ax[0].annotate(f"DJF {a}: ONI {oni_m[a]:+.1f}", (pd.Timestamp(f"{a}-01-15"), oni_m[a]), xytext=(-62 if a == 2016 else 4, -2 if a == 2016 else 4), textcoords="offset points", fontsize=6.5)
ax[0].set_ylim(-2.2, 3.2)
ax[0].set_ylabel("ONI DJF (aprox.)"); ax[0].set_title("a) Índice ONI (DJF) y episodios El Niño moderado/fuerte (≥ 1.0)")
ax[1].plot(x, cl.anom_tmean, color=OCRE, lw=.8); ax[1].axhline(0, color="k", lw=.5)
ax[1].axvspan(pd.Timestamp("2017-01-01"), pd.Timestamp("2017-04-30"), color=AZUL, alpha=.25)
ax[1].annotate("Niño costero 2017\n(ONI neutral)", (pd.Timestamp("2017-03-01"), cl.anom_tmean[cl.fecha == "2017-03"].iloc[0]), xytext=(-70, -4), textcoords="offset points", fontsize=6.5, arrowprops=dict(arrowstyle="-", lw=.6))
ax[1].set_ylabel("Anomalía Tmedia (°C)"); ax[1].set_title("b) Anomalía mensual de temperatura media en la estación de referencia (base 2000–2020)")
fig.tight_layout(); fig.savefig(FIG / "fig03_series_oni_temperatura.png"); plt.close()

# =================================================== Fig 4: climatología y precipitación
fig, ax = plt.subplots(1, 2, figsize=(6.8, 2.8))
mm = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
for col, c, n in (("tmax_c", ROJO, "Tmax"), ("tmin_c", AZUL, "Tmin")):
    g = cl.groupby("mes")[col]; ax[0].plot(range(1, 13), g.mean(), color=c, label=n); ax[0].fill_between(range(1, 13), g.min(), g.max(), color=c, alpha=.15)
ax[0].set_xticks(range(1, 13)); ax[0].set_xticklabels(mm); ax[0].set_ylabel("°C"); ax[0].legend(frameon=False); ax[0].set_title("a) Ciclo anual (media y rango 2000–2026)")
pz = (cl.precip_mm == 0).mean() * 100
ax[1].hist(cl.precip_mm[cl.precip_mm > 0], bins=18, color=AZUL, alpha=.85)
ax[1].set_xlabel("Precipitación mensual > 0 mm"); ax[1].set_ylabel("Meses"); ax[1].set_title(f"b) Precipitación: {pz:.0f} % de meses con 0 mm")
fig.tight_layout(); fig.savefig(FIG / "fig04_climatologia_precipitacion.png"); plt.close()
S["precip_pct_meses_cero"] = round(float(pz), 1); S["precip_max_mm"] = float(cl.precip_mm.max())
S["precip_meses_mayor_5mm"] = int((cl.precip_mm > 5).sum())

# =================================================== Fig 5: distribución del objetivo
fig, ax = plt.subplots(1, 2, figsize=(6.8, 2.8), gridspec_kw={"width_ratios": [1, 1.2]})
ax[0].hist(d.rend_t_ha, bins=18, color=VERDE, alpha=.85, edgecolor="white"); ax[0].axvline(d.rend_t_ha.mean(), color="k", ls="--", lw=.8)
ax[0].set_xlabel("Rendimiento exportable (t/ha)"); ax[0].set_ylabel("Registros"); ax[0].set_title("a) Distribución del objetivo")
orden_v = d.groupby("variedad").rend_t_ha.median().sort_values().index
ax[1].boxplot([d.rend_t_ha[d.variedad == v] for v in orden_v], tick_labels=[f"{v}\n(n={int((d.variedad==v).sum())})" for v in orden_v], widths=.6,
              patch_artist=True, boxprops=dict(facecolor="#BBF7D0"), medianprops=dict(color="k"))
ax[1].tick_params(axis="x", labelsize=6.5); ax[1].set_title("b) Rendimiento por variedad")
fig.tight_layout(); fig.savefig(FIG / "fig05_distribucion_objetivo.png"); plt.close()
t = d.rend_t_ha
S["objetivo"] = {"n": int(len(t)), "media": round(t.mean(), 2), "sd": round(t.std(), 2), "min": round(t.min(), 2),
                 "p25": round(t.quantile(.25), 2), "mediana": round(t.median(), 2), "p75": round(t.quantile(.75), 2),
                 "max": round(t.max(), 2), "asimetria": round(float(stats.skew(t)), 2), "curtosis_exceso": round(float(stats.kurtosis(t)), 2),
                 "cv_pct": round(t.std() / t.mean() * 100, 1)}
sh = stats.shapiro(d.rend_idx); S["shapiro_rend_idx"] = {"W": round(sh.statistic, 3), "p": round(float(sh.pvalue), 4)}
kv = stats.kruskal(*[d.rend_t_ha[d.variedad == v] for v in d.variedad.unique()])
S["kruskal_variedad"] = {"H": round(kv.statistic, 2), "p": float(f"{kv.pvalue:.3g}")}
# ICC (proporción de varianza entre fundos)
gm = d.rend_t_ha.mean(); k = d.fundo_id.nunique(); n_i = d.groupby("fundo_id").size()
ssb = (n_i * (d.groupby("fundo_id").rend_t_ha.mean() - gm) ** 2).sum(); ssw = ((d.rend_t_ha - d.groupby("fundo_id").rend_t_ha.transform("mean")) ** 2).sum()
S["pct_varianza_entre_fundos"] = round(float(ssb / (ssb + ssw) * 100), 1)

# =================================================== Fig 6: series por fundo
fig, ax = plt.subplots(figsize=(6.8, 3.0))
for f, g in d.groupby("fundo_id"): ax.plot(g.anio_inicio, g.rend_t_ha, lw=.7, alpha=.55, color=GRIS)
mc = d.groupby("anio_inicio").rend_t_ha.mean(); ax.plot(mc.index, mc.values, color=VERDE, lw=2, label="Media de la campaña (todos los fundos)")
for y in sorted(d[d.clase_enso_cosecha == "Niño moderado/fuerte"].anio_inicio.unique()): ax.axvspan(y - .4, y + .4, color=ROJO, alpha=.18)
ax.axvspan(2016 - .4, 2016 + .4, color=AZUL, alpha=.18); ax.text(2016, ax.get_ylim()[1] * .985, "costero\n2017", ha="center", va="top", fontsize=6.3)
ax.set_xlabel("Año de inicio de campaña"); ax.set_ylabel("t/ha")
ax.set_title("Rendimiento por fundo; franjas rojas = cosecha en El Niño moderado/fuerte (ONI DJF ≥ 1.0)"); ax.legend(frameon=False, loc="lower left", fontsize=7)
fig.savefig(FIG / "fig06_series_rendimiento.png"); plt.close()

# =================================================== Fig 7 + pruebas: rendimiento relativo por clase ENSO
fig, ax = plt.subplots(figsize=(6.8, 3.2)); rng = np.random.default_rng(SEED)
dat = [d.rend_idx[d.clase_enso_cosecha == c] for c in ORDEN_ENSO]
bp = ax.boxplot(dat, widths=.5, patch_artist=True, medianprops=dict(color="k"), showfliers=False)
for p, c in zip(bp["boxes"], ORDEN_ENSO): p.set_facecolor(COL_ENSO[c]); p.set_alpha(.35)
for i, (c, v) in enumerate(zip(ORDEN_ENSO, dat), 1): ax.scatter(rng.normal(i, .06, len(v)), v, s=9, color=COL_ENSO[c], alpha=.8)
ax.axhline(100, color="k", lw=.6, ls="--")
min_ = d.loc[d.rend_idx.idxmin()]
ax.annotate("Niño costero 2016-17\n(ONI neutral)", (1, min_.rend_idx), xytext=(1.35, 66), fontsize=6.8, arrowprops=dict(arrowstyle="->", lw=.7))
ax.set_xticklabels([f"{c}\n(n={len(v)} registros;\n{d.anio_inicio[d.clase_enso_cosecha==c].nunique()} campañas)" for c, v in zip(ORDEN_ENSO, dat)], fontsize=7)
ax.set_ylabel("Rendimiento relativo (% de la tendencia del fundo)"); ax.set_title("Rendimiento relativo según la clase ENSO de la cosecha")
fig.savefig(FIG / "fig07_rendimiento_por_enso.png"); plt.close()
kw = stats.kruskal(*dat); S["kruskal_enso"] = {"H": round(kw.statistic, 2), "p": float(f"{kw.pvalue:.3g}")}
neu, fue = dat[0], dat[2]; mw = stats.mannwhitneyu(fue, neu, alternative="less")
S["mw_fuerte_vs_neutro"] = {"U": float(mw.statistic), "p_unilateral": float(f"{mw.pvalue:.3g}"),
    "mediana_fuerte": round(float(np.median(fue)), 1), "mediana_neutro": round(float(np.median(neu)), 1),
    "diferencia_puntos": round(float(np.median(fue) - np.median(neu)), 1),
    "cliff_delta": round(float((np.sum([(a > b) - (a < b) for a in fue for b in neu])) / (len(fue) * len(neu))), 2)}
S["clase_enso_tabla"] = [{"clase": c, "registros": int(len(v)), "campanas": int(d.anio_inicio[d.clase_enso_cosecha == c].nunique()),
                          "media_idx": round(float(v.mean()), 1), "mediana_idx": round(float(v.median()), 1),
                          "sd_idx": round(float(v.std()), 1), "media_t_ha": round(float(d.rend_t_ha[d.clase_enso_cosecha == c].mean()), 2)} for c, v in zip(ORDEN_ENSO, dat)]
S["campanas_nino_fuerte"] = sorted(d[d.clase_enso_cosecha == "Niño moderado/fuerte"].campana.unique().tolist())
# 2016-17 (ONI neutral, Niño costero) y 2017-18 (rezago)
for camp in ("2016-2017", "2017-2018"):
    S[f"idx_medio_{camp}"] = round(float(d.rend_idx[d.campana == camp].mean()), 1)

# =================================================== Fig 8: correlación de Spearman
vars_ = ["oni_djf_previo", "anom_tmax_ene_mar", "anom_tmean_abr_jun", "precip_ene_mar_prev", "rend_prev", "rend_media_hist",
         "oni_djf_cosecha", "anom_tmean_set_nov", "hr_set_nov", "precip_ene_mar_cosecha", "hectareas", "anio_inicio", "rend_t_ha"]
rho = d[vars_].corr(method="spearman")
fig, ax = plt.subplots(figsize=(6.6, 5.4)); im = ax.imshow(rho, cmap="RdBu_r", vmin=-1, vmax=1)
ax.set_xticks(range(len(vars_))); ax.set_yticks(range(len(vars_))); ax.set_xticklabels(vars_, rotation=60, ha="right", fontsize=6.5); ax.set_yticklabels(vars_, fontsize=6.5)
for i in range(len(vars_)):
    for j in range(len(vars_)): ax.text(j, i, f"{rho.iloc[i, j]:.2f}", ha="center", va="center", fontsize=5.6, color="white" if abs(rho.iloc[i, j]) > .6 else "black")
ax.grid(False); plt.colorbar(im, fraction=.04); ax.set_title("Correlación de Spearman entre variables (n = 162)")
fig.savefig(FIG / "fig08_correlacion_spearman.png"); plt.close()
cor_obj = {}
for v_ in vars_[:-1]:
    r_, p_ = stats.spearmanr(d[v_], d.rend_t_ha); cor_obj[v_] = {"rho": round(float(r_), 3), "p": float(f"{p_:.3g}")}
S["spearman_con_objetivo"] = cor_obj
# VIF (sobre variables numéricas de entrada)
X = d[vars_[:-1]].astype(float); X = (X - X.mean()) / X.std(); vif = {}
for j, c in enumerate(X.columns):
    y_ = X[c].values; Z = np.delete(X.values, j, axis=1); Z = np.c_[np.ones(len(Z)), Z]
    b = np.linalg.lstsq(Z, y_, rcond=None)[0]; r2 = 1 - ((y_ - Z @ b) ** 2).sum() / ((y_ - y_.mean()) ** 2).sum(); vif[c] = round(float(1 / (1 - r2)), 2)
S["vif"] = vif

# =================================================== Fig 9: correlación con rezago 0-12 meses (HU-05)
clx = cl.set_index("per"); camp = d.groupby("anio_inicio").rend_idx.mean()
res = []
for L in range(0, 13):
    xs = [clx.anom_tmean.get(pd.Period(f"{y+1}-01") - L, np.nan) for y in camp.index]
    r_, p_ = stats.spearmanr(xs, camp.values); res.append((L, r_, p_))
rez = pd.DataFrame(res, columns=["rezago", "rho", "p"])
n_c = len(camp); rcrit = float(stats.t.ppf(.975, n_c - 2) / np.sqrt(n_c - 2 + stats.t.ppf(.975, n_c - 2) ** 2))
fig, ax = plt.subplots(figsize=(6.8, 3.0))
ax.bar(rez.rezago, rez.rho, color=[ROJO if abs(r_) >= rcrit else "#9CA3AF" for r_ in rez.rho]); ax.axhline(0, color="k", lw=.6)
ax.axhline(rcrit, color=GRIS, ls="--", lw=.8); ax.axhline(-rcrit, color=GRIS, ls="--", lw=.8)
ax.set_xticks(range(13)); ax.set_xlabel("Rezago (meses antes de enero de la cosecha)"); ax.set_ylabel("ρ de Spearman")
ax.set_title(f"Correlación rezagada: anomalía de Tmedia vs. rendimiento relativo de la campaña (n = {n_c}); rojo = |ρ| ≥ {rcrit:.2f}", fontsize=8)
fig.savefig(FIG / "fig09_correlacion_rezago.png"); plt.close()
S["rezago"] = {"n_campanas": int(n_c), "rho_critico_5pct": round(rcrit, 3), "tabla": rez.round(3).to_dict("records"),
               "mejor_rezago": int(rez.loc[rez.rho.abs().idxmax(), "rezago"]), "mejor_rho": round(float(rez.loc[rez.rho.abs().idxmax(), "rho"]), 3)}

# =================================================== Fig 10: dispersión de variables clave
fig, ax = plt.subplots(1, 2, figsize=(6.8, 3.0), sharey=True)
for a, col, tt in ((ax[0], "anom_tmean_set_nov", "Anomalía Tmedia set–nov (°C) [B]"), (ax[1], "anom_tmax_ene_mar", "Anomalía Tmax ene–mar (°C) [A]")):
    for c in ORDEN_ENSO: s_ = d[d.clase_enso_cosecha == c]; a.scatter(s_[col], s_.rend_idx, s=11, color=COL_ENSO[c], alpha=.75, label=c)
    b = np.polyfit(d[col], d.rend_idx, 1); xs = np.linspace(d[col].min(), d[col].max(), 50); a.plot(xs, np.polyval(b, xs), color="k", lw=1)
    a.axhline(100, color="k", lw=.5, ls=":"); a.set_xlabel(tt)
ax[0].set_ylabel("Rendimiento relativo (%)"); ax[1].legend(frameon=False, fontsize=6.3, loc="lower left")
fig.suptitle("Relación entre anomalías térmicas y rendimiento relativo", fontsize=9.5, fontweight="bold"); fig.tight_layout()
fig.savefig(FIG / "fig10_dispersion_clave.png"); plt.close()
for col in ("anom_tmean_set_nov", "anom_tmax_ene_mar"):
    r_, p_ = stats.spearmanr(d[col], d.rend_idx); S[f"spearman_idx_{col}"] = {"rho": round(float(r_), 3), "p": float(f"{p_:.3g}")}
# asimetría: pendiente con anomalía <0 vs >0
for col in ("anom_tmean_set_nov",):
    pos, neg = d[d[col] > 0], d[d[col] <= 0]
    S["pendiente_pos"] = round(float(np.polyfit(pos[col], pos.rend_idx, 1)[0]), 2); S["pendiente_neg"] = round(float(np.polyfit(neg[col], neg.rend_idx, 1)[0]), 2)

# =================================================== descriptivos de todas las variables
desc = d[vars_ + ["rend_idx"]].describe().T[["count", "mean", "std", "min", "50%", "max"]].round(2)
desc.to_csv(REP / "descriptivos_variables.csv")
S["descriptivos"] = desc.reset_index().rename(columns={"index": "variable"}).to_dict("records")
S["panel"] = {"registros": int(len(d)), "fundos": int(d.fundo_id.nunique()), "campanas": int(d.anio_inicio.nunique()),
              "campanas_por_fundo_min": int(d.groupby("fundo_id").size().min()), "campanas_por_fundo_max": int(d.groupby("fundo_id").size().max()),
              "variedades": d.variedad.value_counts().to_dict()}
json.dump(S, open(REP / "eda_estadisticas.json", "w"), indent=2, ensure_ascii=False, default=float)
print(json.dumps({k: S[k] for k in S if k not in ("descriptivos", "rezago", "spearman_con_objetivo")}, indent=1, ensure_ascii=False, default=float))
print("REZAGO:", [(r['rezago'], r['rho'], r['p']) for r in S['rezago']['tabla']], "rcrit", S['rezago']['rho_critico_5pct'])
print("SPEARMAN-OBJ:", {k: v['rho'] for k, v in S['spearman_con_objetivo'].items()})
