"""
features.py — AgroPredic APF3
Construcción de la tabla de modelado. Separada del ETL para poder probar la ausencia de fuga de datos
(tests/test_no_fuga.py). Conjunto A = observado al 30-jun del año y; Conjunto B = futuro (escenario).
"""
import pandas as pd


def construir_features(r: pd.DataFrame, cl: pd.DataFrame, oni: pd.Series) -> pd.DataFrame:
    """r: rendimiento limpio (con anio_inicio); cl: clima limpio indexado por Period mensual
    (columnas anom_tmax, anom_tmean, hr_pct, precip_mm); oni: serie ONI DJF indexada por año."""

    def v(y, m0, m1, col, f="mean"):
        s = cl.loc[pd.Period(f"{y}-{m0:02d}"):pd.Period(f"{y}-{m1:02d}"), col]
        return getattr(s, f)()

    filas = []
    for _, row in r.dropna(subset=["rendimiento_exportable_t_ha"]).iterrows():
        y = int(row.anio_inicio)
        filas.append({
            "fundo_id": row.fundo_id, "campana": row.campana, "anio_inicio": y,
            "variedad": row.variedad, "hectareas": int(row.hectareas),
            # ---- Conjunto A: disponible al 30-jun del año y
            "oni_djf_previo": oni[y],
            "anom_tmax_ene_mar": v(y, 1, 3, "anom_tmax"),
            "anom_tmean_abr_jun": v(y, 4, 6, "anom_tmean"),
            "precip_ene_mar_prev": v(y, 1, 3, "precip_mm", "sum"),
            # ---- Conjunto B: escenario/futuro respecto del 30-jun
            "oni_djf_cosecha": oni[y + 1],
            "anom_tmean_set_nov": v(y, 9, 11, "anom_tmean"),
            "hr_set_nov": v(y, 9, 11, "hr_pct"),
            "precip_ene_mar_cosecha": v(y + 1, 1, 3, "precip_mm", "sum"),
            "rend_t_ha": row.rendimiento_exportable_t_ha})
    m = pd.DataFrame(filas).sort_values(["fundo_id", "anio_inicio"]).reset_index(drop=True)
    # derivadas del propio rendimiento: SOLO campañas anteriores (sin fuga)
    g = m.groupby("fundo_id")["rend_t_ha"]
    m["rend_prev"] = g.shift(1)
    m["rend_media_hist"] = g.transform(lambda s: s.shift(1).expanding().mean())
    m["n_campanas_previas"] = m.groupby("fundo_id").cumcount()
    return m


CONJUNTO_A = ["oni_djf_previo", "anom_tmax_ene_mar", "anom_tmean_abr_jun", "precip_ene_mar_prev",
              "rend_prev", "rend_media_hist", "n_campanas_previas", "hectareas", "anio_inicio"]
CONJUNTO_B = ["oni_djf_cosecha", "anom_tmean_set_nov", "hr_set_nov", "precip_ene_mar_cosecha"]
