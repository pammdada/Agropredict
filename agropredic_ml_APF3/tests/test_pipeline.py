"""
Pruebas automáticas del pipeline de datos (AgroPredic APF3).  Ejecutar:  python -m pytest -q   (desde la raíz)
o bien:  python tests/test_pipeline.py
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
from features import construir_features, CONJUNTO_A, CONJUNTO_B   # noqa: E402

PROC, RAW = ROOT / "data" / "processed", ROOT / "data" / "raw"


def _cargar():
    cl = pd.read_csv(PROC / "clima_ica_mensual.csv"); cl["per"] = pd.PeriodIndex(cl.fecha, freq="M"); cl = cl.set_index("per")
    r = pd.read_csv(PROC / "rendimiento_fundos.csv").rename(columns={"rend_t_ha": "rendimiento_exportable_t_ha"})
    oni = pd.read_csv(RAW / "oni_djf.csv").set_index("anio_djf").oni_djf
    return r, cl, oni


def test_dataset_sin_nulos_y_rangos():
    d = pd.read_csv(PROC / "dataset_modelado.csv")
    assert d.isna().sum().sum() == 0
    assert d.rend_t_ha.between(5, 40).all()
    assert not d.duplicated(["fundo_id", "campana"]).any()
    assert d.groupby("fundo_id").size().min() >= 5            # dataset mínimo viable (APF2): >= 5 campañas


def test_clima_calendario_completo_y_sin_nulos():
    c = pd.read_csv(PROC / "clima_ica_mensual.csv")
    assert c[["tmax_c", "tmin_c", "precip_mm", "hr_pct"]].isna().sum().sum() == 0
    per = pd.PeriodIndex(c.fecha, freq="M"); assert len(per.difference(pd.period_range(per.min(), per.max(), freq="M"))) == 0
    assert (c.tmin_c < c.tmax_c).all()


def test_conjunto_A_no_depende_del_futuro():
    """Si se altera TODO el clima posterior al 30-jun del año y, el Conjunto A de la campaña y no debe cambiar."""
    r, cl, oni = _cargar(); base = construir_features(r, cl, oni).set_index(["fundo_id", "anio_inicio"])
    for y in (2005, 2012, 2016, 2023):
        cl2 = cl.copy(); fut = cl2.index > pd.Period(f"{y}-06")
        for col in ("anom_tmax", "anom_tmean", "precip_mm", "hr_pct"): cl2.loc[fut, col] = cl2.loc[fut, col] + 50
        oni2 = oni.copy(); oni2.loc[oni2.index > y] = oni2.loc[oni2.index > y] + 5          # ONI posterior a DJF(y)
        alt = construir_features(r, cl2, oni2).set_index(["fundo_id", "anio_inicio"])
        idx = base.index.get_level_values("anio_inicio") == y
        a_cols = ["oni_djf_previo", "anom_tmax_ene_mar", "anom_tmean_abr_jun", "precip_ene_mar_prev"]
        pd.testing.assert_frame_equal(base.loc[idx, a_cols], alt.loc[idx, a_cols])
        assert not np.allclose(base.loc[idx, CONJUNTO_B[1]], alt.loc[idx, CONJUNTO_B[1]])  # B sí cambia (es futuro)


def test_rendimiento_propio_no_se_filtra():
    """Alterar el rendimiento de la campaña y no puede modificar ninguna variable de entrada de la campaña y."""
    r, cl, oni = _cargar(); base = construir_features(r, cl, oni).set_index(["fundo_id", "anio_inicio"])
    r2 = r.copy(); sel = (r2.fundo_id == "F03") & (r2.anio_inicio == 2012)
    r2.loc[sel, "rendimiento_exportable_t_ha"] += 9
    alt = construir_features(r2, cl, oni).set_index(["fundo_id", "anio_inicio"])
    cols = [c for c in CONJUNTO_A + CONJUNTO_B if c != "anio_inicio"]
    pd.testing.assert_series_equal(base.loc[("F03", 2012), cols].astype(float), alt.loc[("F03", 2012), cols].astype(float))
    assert alt.loc[("F03", 2013), "rend_prev"] == base.loc[("F03", 2012), "rend_t_ha"] + 9   # sí afecta a la campaña SIGUIENTE


def test_rend_prev_es_la_campana_anterior():
    d = pd.read_csv(PROC / "dataset_modelado.csv").sort_values(["fundo_id", "anio_inicio"])
    full = pd.read_csv(PROC / "rendimiento_fundos.csv").set_index(["fundo_id", "anio_inicio"]).rend_t_ha
    for _, f in d.iterrows():
        prev = full[f.fundo_id][full[f.fundo_id].index < f.anio_inicio].dropna()
        assert abs(prev.iloc[-1] - f.rend_prev) < 0.006


if __name__ == "__main__":
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_"): fn(); print("OK ", nombre)
