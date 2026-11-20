import csv
import json
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parents[1]
DATASET = BASE / "agropredic_ml_APF3" / "data" / "processed" / "dataset_modelado.csv"
OUT = BASE / "src" / "lib" / "simulation" / "apf3" / "model.json"

FEATURES = [
    "oni_djf_previo",
    "anom_tmax_ene_mar",
    "anom_tmean_abr_jun",
    "precip_ene_mar_prev",
    "rend_prev",
    "rend_media_hist",
    "n_campanas_previas",
    "hectareas",
    "oni_djf_cosecha",
    "anom_tmean_set_nov",
    "hr_set_nov",
    "precip_ene_mar_cosecha",
]
CLIMATE_FEATURES = {
    "oni_djf_previo": "oni_djf_previo",
    "anom_tmax_ene_mar": "oni_djf_previo",
    "anom_tmean_abr_jun": "oni_djf_previo",
    "precip_ene_mar_prev": "oni_djf_previo",
    "oni_djf_cosecha": "oni_djf_cosecha",
    "anom_tmean_set_nov": "oni_djf_cosecha",
    "hr_set_nov": "oni_djf_cosecha",
    "precip_ene_mar_cosecha": "oni_djf_cosecha",
}
TARGET = "rend_t_ha"
ALPHA = 10.0
HOLDOUT_YEAR = 2021


def load_rows():
    with DATASET.open(newline="", encoding="utf-8") as handle:
        raw_rows = list(csv.DictReader(handle))

    rows = []
    missing = 0
    for raw in raw_rows:
        values = {}
        valid = True
        for name in FEATURES + [TARGET]:
            text = (raw.get(name) or "").strip()
            if text == "" or text.lower() in {"na", "nan"}:
                missing += 1
                valid = False
                continue
            values[name] = float(text)
        if valid:
            values["fundo_id"] = raw["fundo_id"]
            values["anio_inicio"] = int(raw["anio_inicio"])
            rows.append(values)

    duplicates = len(rows) - len({(row["fundo_id"], row["anio_inicio"]) for row in rows})
    return rows, missing, duplicates


def matrix(rows):
    x = np.array([[row[name] for name in FEATURES] for row in rows])
    y = np.array([row[TARGET] for row in rows])
    return x, y


def fit_ridge(x, y):
    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    scale[scale == 0] = 1.0
    y_mean = float(y.mean())
    x_scaled = (x - mean) / scale
    y_centered = y - y_mean
    coefficients = np.linalg.solve(
        x_scaled.T @ x_scaled + ALPHA * np.eye(x.shape[1]),
        x_scaled.T @ y_centered,
    )
    return coefficients, y_mean, mean, scale


def predict(x, coefficients, intercept, mean, scale):
    return intercept + ((x - mean) / scale) @ coefficients


def metrics(y_true, y_pred):
    error = y_true - y_pred
    return {
        "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error**2))),
        "mape": float(np.mean(np.abs(error / y_true)) * 100),
        "r2": float(1 - np.sum(error**2) / np.sum((y_true - y_true.mean()) ** 2)),
    }


def leave_one_farm_out(rows):
    x, y = matrix(rows)
    farms = np.array([row["fundo_id"] for row in rows])
    predictions = np.empty_like(y)
    for farm in np.unique(farms):
        mask = farms == farm
        coefficients, intercept, mean, scale = fit_ridge(x[~mask], y[~mask])
        predictions[mask] = predict(x[mask], coefficients, intercept, mean, scale)
    return predictions


def ols(x, y):
    x_mean = float(x.mean())
    y_mean = float(y.mean())
    denominator = float(np.sum((x - x_mean) ** 2))
    slope = float(np.sum((x - x_mean) * (y - y_mean)) / denominator) if denominator > 0 else 0.0
    return y_mean - slope * x_mean, slope


def scenario_map(rows):
    data = {name: np.array([row[name] for row in rows]) for name in FEATURES}
    climates = {}
    for feature, driver in CLIMATE_FEATURES.items():
        if feature == driver:
            intercept, slope = 0.0, 1.0
        else:
            intercept, slope = ols(data[driver], data[feature])
        climates[feature] = {
            "driver": driver,
            "intercept": round(intercept, 6),
            "slope": round(slope, 6),
        }
    return climates


def main():
    rows, missing, duplicates = load_rows()
    if len(rows) < 30:
        raise SystemExit(f"Dataset insuficiente: solo {len(rows)} registros válidos.")

    x, y = matrix(rows)
    coefficients, intercept, mean, scale = fit_ridge(x, y)

    oof_predictions = leave_one_farm_out(rows)
    validation = metrics(y, oof_predictions)
    residuals = y - oof_predictions
    q10, q90 = (float(value) for value in np.quantile(residuals, [0.1, 0.9]))
    coverage = float(np.mean((y >= oof_predictions + q10) & (y <= oof_predictions + q90)) * 100)

    train_rows = [row for row in rows if row["anio_inicio"] < HOLDOUT_YEAR]
    test_rows = [row for row in rows if row["anio_inicio"] >= HOLDOUT_YEAR]
    if not train_rows or not test_rows:
        raise SystemExit("El split temporal no produjo train/test válidos.")
    x_train, y_train = matrix(train_rows)
    x_test, y_test = matrix(test_rows)
    train_coefficients, train_intercept, train_mean, train_scale = fit_ridge(x_train, y_train)
    test_predictions = predict(x_test, train_coefficients, train_intercept, train_mean, train_scale)
    test = metrics(y_test, test_predictions)

    years = [row["anio_inicio"] for row in rows]
    payload = {
        "version": "agropredic-apf3-ridge-v2.0",
        "algorithm": "StandardScaler + Ridge(alpha=10.0)",
        "target": TARGET,
        "features": FEATURES,
        "means": [float(value) for value in mean],
        "scales": [float(value) for value in scale],
        "coefficients": [float(value) for value in coefficients],
        "intercept": float(intercept),
        "residuals": {"q10": round(q10, 4), "q90": round(q90, 4)},
        "metrics": {
            "maeValidation": round(validation["mae"], 4),
            "rmseValidation": round(validation["rmse"], 4),
            "mapeValidation": round(validation["mape"], 2),
            "r2Validation": round(validation["r2"], 4),
            "maeTest": round(test["mae"], 4),
            "rmseTest": round(test["rmse"], 4),
            "mapeTest": round(test["mape"], 2),
            "r2Test": round(test["r2"], 4),
            "coveragePct": round(coverage, 1),
        },
        "training": {
            "records": int(len(rows)),
            "farms": int(len({row["fundo_id"] for row in rows})),
            "campaigns": f"{min(years)}-{max(years)}",
            "missing": int(missing),
            "duplicates": int(duplicates),
            "meanYield": round(float(y.mean()), 3),
            "stdYield": round(float(y.std(ddof=1)), 3),
            "source": "synthetic",
        },
        "scenario": {"climates": scenario_map(rows)},
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Modelo exportado a {OUT}")
    print(
        "Validación leave-one-farm-out: "
        f"MAE={validation['mae']:.3f} R2={validation['r2']:.3f} cobertura={coverage:.1f}%"
    )
    print(
        f"Test temporal (>= {HOLDOUT_YEAR}): "
        f"MAE={test['mae']:.3f} R2={test['r2']:.3f} "
        f"(train={len(train_rows)}, test={len(test_rows)})"
    )
    print(
        f"Dataset: {len(rows)} registros, "
        f"{payload['training']['farms']} fundos, "
        f"{payload['training']['campaigns']}, "
        f"media={payload['training']['meanYield']:.2f} t/ha"
    )


if __name__ == "__main__":
    main()
