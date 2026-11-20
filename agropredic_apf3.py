"""
AgroPredic - APF3: dataset sintetico + modelo de prediccion de rendimiento exportable (t/ha)
Uva de mesa, Valle de Ica.

Ejecucion:   python agropredic_apf3.py
Salidas:     data/*.csv, outputs/*.csv, outputs/*.png, models/modelo_agropredic.joblib

IMPORTANTE (declararlo en el informe): TODOS los datos son SINTETICOS. Las metricas
miden que tan bien el modelo recupera relaciones que YO programe en el generador;
NO demuestran precision real. Con datos reales de SENAMHI/MIDAGRI y de un fundo,
basta reemplazar la funcion `generar_datos()` por la lectura de los CSV reales.
"""
import json
import os
import warnings

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
SEED = 42
rng = np.random.default_rng(SEED)
BASE = os.path.dirname(os.path.abspath(__file__))
for d in ("data", "outputs", "models"):
    os.makedirs(os.path.join(BASE, d), exist_ok=True)

# ---------------------------------------------------------------------------
# 1. DATOS SINTETICOS
# ---------------------------------------------------------------------------
# Campana c = agosto de (c-1) a julio de c (cosecha principal ~ dic-feb).
# Para predecir con ~6-8 meses de anticipacion usamos SOLO clima hasta el mes
# de corte (mayo del anio c-1 ... ver HORIZONTE). Asi evitamos fuga de datos.

ANIO_INI, ANIO_FIN = 2000, 2026          # campanas 2000 ... 2026 (27)
EVENTOS_NINO = {                          # anio de campana: intensidad (0 neutro, 1 moderado, 2 fuerte)
    2003: 1, 2007: 1, 2010: 1, 2015: 1, 2016: 2, 2018: 1, 2024: 2, 2026: 1,
}
FUNDOS = {  # id: (hectareas, anios_historial, rendimiento_base_t_ha, sensibilidad)
    "F01": (70, 27, 17.0, 1.00),
    "F02": (45, 27, 16.0, 0.90),
    "F03": (120, 25, 18.0, 1.10),
    "F04": (60, 24, 15.5, 1.00),
    "F05": (85, 22, 16.5, 0.95),
    "F06": (30, 20, 15.0, 1.15),
}


def generar_datos():
    """Devuelve (clima_mensual, rendimiento_por_fundo) sinteticos."""
    # --- clima mensual (anomalia de temperatura en C, precipitacion en mm) ---
    filas = []
    for anio in range(ANIO_INI - 2, ANIO_FIN + 1):
        for mes in range(1, 13):
            nivel = EVENTOS_NINO.get(anio, 0)
            # el calentamiento se concentra en dic-abr (verano) y se arrastra al anio siguiente
            pico = np.exp(-((mes - 2.5) ** 2) / 8.0) if mes <= 6 else np.exp(-((mes - 14.5) ** 2) / 8.0)
            nino_prev = EVENTOS_NINO.get(anio - 1, 0)
            anom = (0.9 * nivel * pico + 0.35 * nino_prev * (mes >= 6)
                    + rng.normal(0, 0.35))
            precip = max(0.0, rng.gamma(1.2, 0.8) + 4.0 * nivel * pico * (mes <= 4))
            filas.append((anio, mes, round(anom, 3), round(precip, 2)))
    clima = pd.DataFrame(filas, columns=["anio", "mes", "anom_temp_c", "precip_mm"])

    # --- rendimiento por fundo y campana ---
    def ventana(anio, m_ini, m_fin, col):
        s = clima[(clima.anio == anio) & clima.mes.between(m_ini, m_fin)][col]
        return s.mean()

    rend = []
    for fid, (ha, hist, base, sens) in FUNDOS.items():
        efecto_fundo = rng.normal(0, 0.4)
        tendencia = rng.uniform(0.01, 0.05)
        for camp in range(ANIO_FIN - hist + 1, ANIO_FIN + 1):
            # El rendimiento de la campana `camp` depende del clima del verano PREVIO
            # (floracion/cuajado, ene-abr del anio camp-1) y de la brotacion (may-jul camp-1)
            t_flor = ventana(camp - 1, 1, 4, "anom_temp_c")
            t_brot = ventana(camp - 1, 5, 7, "anom_temp_c")
            p_flor = ventana(camp - 1, 1, 4, "precip_mm")
            t_cosecha = ventana(camp, 1, 2, "anom_temp_c")   # NO se usa como predictor (futuro)
            y = (base + efecto_fundo + tendencia * (camp - ANIO_INI)
                 - sens * (1.7 * max(t_flor, 0) ** 1.2 + 0.8 * max(t_brot, 0)
                           + 0.12 * p_flor + 0.5 * max(t_cosecha, 0))
                 + rng.normal(0, 0.55))
            rend.append((fid, camp, ha, round(max(y, 4.0), 2)))
    rend = pd.DataFrame(rend, columns=["fundo", "campana", "hectareas", "rend_export_t_ha"])
    return clima, rend


# ---------------------------------------------------------------------------
# 2. FEATURES (solo informacion disponible al momento del pronostico)
# ---------------------------------------------------------------------------
def construir_features(clima, rend, horizonte_corte_mes=7):
    """
    Pronostico emitido a fines de `horizonte_corte_mes` del anio camp-1 (julio => ~6 meses
    antes de la cosecha de dic-feb). Se usan solo meses <= corte: sin fuga de datos.
    """
    c = clima.set_index(["anio", "mes"])

    def vent(anio, m1, m2, col):
        return c.loc[[(anio, m) for m in range(m1, m2 + 1)], col].mean()

    X = []
    for _, r in rend.iterrows():
        a = int(r.campana) - 1
        X.append({
            "fundo": r.fundo, "campana": int(r.campana),
            "hectareas": r.hectareas,
            "temp_ene_abr": vent(a, 1, 4, "anom_temp_c"),     # rezago ~9-12 meses
            "temp_may_jul": vent(a, 5, 7, "anom_temp_c"),     # rezago ~6-8 meses
            "temp_ago_dic_prev": vent(a - 1, 8, 12, "anom_temp_c"),
            "precip_ene_abr": vent(a, 1, 4, "precip_mm"),
            "precip_may_jul": vent(a, 5, 7, "precip_mm"),
            "temp_x_precip": vent(a, 1, 4, "anom_temp_c") * vent(a, 1, 4, "precip_mm"),
            "nino_fuerte": int(vent(a, 1, 4, "anom_temp_c") > 1.2),
            "rend_t_ha": r.rend_export_t_ha,
        })
    df = pd.DataFrame(X).sort_values(["campana", "fundo"]).reset_index(drop=True)
    # historial del fundo: media de campanas ANTERIORES (nunca incluye la actual -> sin fuga)
    df["rend_media_previa"] = (df.groupby("fundo")["rend_t_ha"]
                               .transform(lambda s: s.shift(1).expanding().mean()))
    df["n_campanas_previas"] = df.groupby("fundo").cumcount()
    df = df.dropna(subset=["rend_media_previa"]).reset_index(drop=True)
    df["fundo_cod"] = df["fundo"].str[1:].astype(int)
    return df


PREDICTORES = ["temp_ene_abr", "temp_may_jul", "temp_ago_dic_prev", "precip_ene_abr",
               "precip_may_jul", "temp_x_precip", "rend_media_previa", "hectareas"]
OBJETIVO = "rend_t_ha"


# ---------------------------------------------------------------------------
# 3. MODELOS Y METRICAS
# ---------------------------------------------------------------------------
def modelos():
    return {
        "Baseline (media historica del fundo)": None,   # regla simple, ver abajo
        "Regresion lineal": Pipeline([("sc", StandardScaler()), ("m", LinearRegression())]),
        "Ridge": Pipeline([("sc", StandardScaler()), ("m", Ridge(alpha=3.0, random_state=SEED))]),
        "Random Forest": RandomForestRegressor(n_estimators=300, min_samples_leaf=3,
                                               random_state=SEED, n_jobs=-1),
    }


def mape(y, p):
    return float(np.mean(np.abs((y - p) / y)) * 100)


def metricas(y, p):
    return {"MAE": mean_absolute_error(y, p),
            "RMSE": float(np.sqrt(mean_squared_error(y, p))),
            "MAPE_%": mape(y, p), "R2": r2_score(y, p)}


def predecir(nombre, modelo, Xtr, ytr, Xte):
    if nombre.startswith("Baseline"):
        return Xte["rend_media_previa"].values
    m = modelo.fit(Xtr[PREDICTORES], ytr)
    return m.predict(Xte[PREDICTORES])


def rolling_origin(df, nombre, modelo, campanas_val):
    """Backtesting temporal: para cada campana de validacion, entrena SOLO con campanas anteriores."""
    out = []
    for c in campanas_val:
        tr, te = df[df.campana < c], df[df.campana == c]
        p = predecir(nombre, modelo, tr, tr[OBJETIVO], te)
        out.append(pd.DataFrame({"campana": c, "fundo": te.fundo.values,
                                 "y": te[OBJETIVO].values, "pred": p}))
    return pd.concat(out, ignore_index=True)


def main():
    # ---------------- datos ----------------
    clima, rend = generar_datos()
    clima.to_csv(os.path.join(BASE, "data", "clima_mensual_ica_sintetico.csv"), index=False)
    rend.to_csv(os.path.join(BASE, "data", "rendimiento_fundos_sintetico.csv"), index=False)
    df = construir_features(clima, rend)
    df.to_csv(os.path.join(BASE, "data", "dataset_modelo.csv"), index=False)
    print(f"Dataset de modelado: {df.shape[0]} registros, {df.shape[1]} columnas")

    # Calidad de datos (tabla 3.1 de la plantilla)
    calidad = {
        "registros": int(len(df)), "variables": int(df.shape[1]),
        "fundos": int(df.fundo.nunique()),
        "campanas": f"{df.campana.min()}-{df.campana.max()}",
        "faltantes": int(df.isna().sum().sum()), "duplicados": int(df.duplicated().sum()),
        "rend_media": round(df[OBJETIVO].mean(), 2), "rend_std": round(df[OBJETIVO].std(), 2),
    }
    print(calidad)

    # ---------------- particion temporal ----------------
    # Train: campanas <= 2021 | Prueba (NO se toca para ajustar): 2022-2026
    CORTE_TEST = 2022
    trainval = df[df.campana < CORTE_TEST].copy()
    test = df[df.campana >= CORTE_TEST].copy()
    camp_val = sorted(trainval.campana.unique())[-6:]    # ultimas 6 campanas de train = validacion rolling
    print(f"Train+val: {len(trainval)} | Test: {len(test)} (campanas {sorted(test.campana.unique())})")

    # ---------------- validacion ----------------
    resultados, preds_val = [], {}
    for nombre, mod in modelos().items():
        pv = rolling_origin(trainval, nombre, mod, camp_val)
        preds_val[nombre] = pv
        m = metricas(pv.y, pv.pred)
        resultados.append({"modelo": nombre, **{f"{k}_val": v for k, v in m.items()}})
    res = pd.DataFrame(resultados).set_index("modelo")

    # ---------------- prueba final (modelos reentrenados con TODO train+val) ----------------
    preds_test = {}
    for nombre, mod in modelos().items():
        p = predecir(nombre, mod, trainval, trainval[OBJETIVO], test)
        preds_test[nombre] = p
        for k, v in metricas(test[OBJETIVO].values, p).items():
            res.loc[nombre, f"{k}_test"] = v
    res = res.round(3)
    res.to_csv(os.path.join(BASE, "outputs", "tabla_metricas.csv"))
    print("\n=== METRICAS (validacion rolling-origin | prueba) ===")
    print(res.to_string())

    # Seleccion: menor MAE de VALIDACION entre modelos reales; preferir el mas simple si diferencia < 5 %
    reales = res.drop(index=[i for i in res.index if i.startswith("Baseline")])
    mejor = reales["MAE_val"].idxmin()
    orden_simple = ["Regresion lineal", "Ridge", "Random Forest"]
    for n in orden_simple:
        if reales.loc[n, "MAE_val"] <= reales.loc[mejor, "MAE_val"] * 1.05:
            mejor = n
            break
    print(f"\nModelo seleccionado (por validacion, no por prueba): {mejor}")

    # ---------------- rango optimista / central / pesimista + cobertura ----------------
    # Percentiles 10 y 90 de los residuos de VALIDACION (no de la prueba).
    pv = preds_val[mejor]
    resid_val = pv.y - pv.pred
    q10, q90 = np.percentile(resid_val, [10, 90])
    pred_test = preds_test[mejor]
    y_test = test[OBJETIVO].values
    pes, opt = pred_test + q10, pred_test + q90
    cobertura = float(np.mean((y_test >= pes) & (y_test <= opt)) * 100)
    print(f"Residuos val P10={q10:.2f}, P90={q90:.2f} -> cobertura del rango en prueba = {cobertura:.1f} %")

    mape_test = res.loc[mejor, "MAPE_%_test"]
    cumple = (mape_test <= 15) and (cobertura >= 80)
    print(f"Criterio APF2 (MAPE<=15 % y cobertura>=80 %): {'CUMPLE' if cumple else 'NO CUMPLE'}")

    # ---------------- analisis de errores ----------------
    det = test[["fundo", "campana", OBJETIVO]].copy()
    det["pred_central"], det["pesimista"], det["optimista"] = pred_test, pes, opt
    det["error_t_ha"] = det[OBJETIVO] - det["pred_central"]
    det["error_abs_pct"] = (det["error_t_ha"].abs() / det[OBJETIVO] * 100).round(1)
    det["dentro_rango"] = (det[OBJETIVO] >= pes) & (det[OBJETIVO] <= opt)
    det.round(2).to_csv(os.path.join(BASE, "outputs", "predicciones_test.csv"), index=False)
    peor = det.sort_values("error_abs_pct", ascending=False).head(5)
    print("\nCasos con mayor error en prueba:\n", peor.round(2).to_string(index=False))
    sub_nino = det[det.campana.isin([2024, 2026])]   # campanas posteriores a Nino fuerte/moderado
    err_nino = float(sub_nino["error_abs_pct"].mean())
    err_resto = float(det[~det.campana.isin([2024, 2026])]["error_abs_pct"].mean())
    print(f"MAPE en campanas post-Nino: {err_nino:.1f} % vs resto: {err_resto:.1f} %")

    # ---------------- robustez: estabilidad por semilla del RF + sensibilidad a ruido ----------------
    maes = []
    for s in range(10):
        rf = RandomForestRegressor(n_estimators=300, min_samples_leaf=3, random_state=s, n_jobs=-1)
        rf.fit(trainval[PREDICTORES], trainval[OBJETIVO])
        maes.append(mean_absolute_error(y_test, rf.predict(test[PREDICTORES])))
    print(f"Robustez RF (10 semillas): MAE test = {np.mean(maes):.3f} +/- {np.std(maes):.3f}")
    final = modelos()[mejor].fit(trainval[PREDICTORES], trainval[OBJETIVO])
    Xr = test[PREDICTORES].copy()
    Xr["temp_ene_abr"] += rng.normal(0, 0.3, len(Xr))      # ruido de medicion +-0.3 C
    mae_ruido = mean_absolute_error(y_test, final.predict(Xr))
    print(f"Sensibilidad: MAE test con ruido de 0.3 C en temperatura = {mae_ruido:.3f}")

    # ---------------- interpretabilidad ----------------
    pi = permutation_importance(final, test[PREDICTORES], y_test, n_repeats=30,
                                random_state=SEED, scoring="neg_mean_absolute_error")
    imp = pd.Series(pi.importances_mean, index=PREDICTORES).sort_values(ascending=False)
    imp.round(4).to_csv(os.path.join(BASE, "outputs", "importancia_variables.csv"), header=["importancia"])
    print("\nImportancia por permutacion (aumento del MAE):\n", imp.round(3).to_string())

    # ---------------- figuras ----------------
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.errorbar(y_test, pred_test, yerr=[pred_test - pes, opt - pred_test], fmt="o",
                color="#1f5f3f", ecolor="#9bc9ae", capsize=2, label="Prediccion y rango P10-P90")
    lim = [min(y_test.min(), pes.min()) - 0.5, max(y_test.max(), opt.max()) + 0.5]
    ax.plot(lim, lim, "k--", lw=1, label="Prediccion perfecta")
    ax.set_xlabel("Rendimiento real (t/ha)"); ax.set_ylabel("Rendimiento predicho (t/ha)")
    ax.set_title(f"{mejor}: real vs. predicho (prueba 2022-2026)"); ax.legend(); fig.tight_layout()
    fig.savefig(os.path.join(BASE, "outputs", "fig_real_vs_predicho.png"), dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4))
    comp = res[["MAE_val", "MAE_test"]]
    comp.plot.bar(ax=ax, color=["#9bc9ae", "#1f5f3f"]); ax.set_ylabel("MAE (t/ha)")
    ax.set_title("Comparacion de modelos (MAE)"); plt.xticks(rotation=20, ha="right"); fig.tight_layout()
    fig.savefig(os.path.join(BASE, "outputs", "fig_comparacion_modelos.png"), dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    imp.sort_values().plot.barh(ax=ax, color="#1f5f3f"); ax.set_xlabel("Aumento del MAE al permutar (t/ha)")
    ax.set_title("Importancia de variables"); fig.tight_layout()
    fig.savefig(os.path.join(BASE, "outputs", "fig_importancia.png"), dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.scatter(df.temp_ene_abr, df[OBJETIVO], c=df.campana, cmap="viridis", s=18)
    ax.set_xlabel("Anomalia de temperatura ene-abr previa (C)"); ax.set_ylabel("Rendimiento (t/ha)")
    ax.set_title("EDA: clima del verano previo vs. rendimiento"); fig.tight_layout()
    fig.savefig(os.path.join(BASE, "outputs", "fig_eda_temp_vs_rend.png"), dpi=160); plt.close(fig)

    corr = df[PREDICTORES + [OBJETIVO]].corr()[OBJETIVO].drop(OBJETIVO).round(3)
    corr.to_csv(os.path.join(BASE, "outputs", "correlaciones_eda.csv"), header=["corr_con_rendimiento"])

    # ---------------- serializacion ----------------
    modelo_final = modelos()[mejor].fit(df[PREDICTORES], df[OBJETIVO])    # reentrenado con todo para uso en MVP
    paquete = {"modelo": modelo_final, "predictores": PREDICTORES, "q10": float(q10), "q90": float(q90),
               "nombre": mejor, "version": "v1.0-sintetico"}
    joblib.dump(paquete, os.path.join(BASE, "models", "modelo_agropredic.joblib"))
    resumen = {"modelo": mejor, "calidad": calidad, "cobertura_pct": round(cobertura, 1),
               "q10": round(float(q10), 3), "q90": round(float(q90), 3),
               "mape_post_nino": round(err_nino, 1), "mape_resto": round(err_resto, 1),
               "mae_rf_semillas": [round(float(np.mean(maes)), 3), round(float(np.std(maes)), 3)],
               "mae_con_ruido": round(float(mae_ruido), 3), "cumple_criterio": bool(cumple)}
    with open(os.path.join(BASE, "outputs", "resumen.json"), "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)
    print("\nModelo guardado en models/modelo_agropredic.joblib")


if __name__ == "__main__":
    main()
