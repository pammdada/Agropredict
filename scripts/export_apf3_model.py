import csv
import json
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parents[1]
APF3 = BASE / "agropredic_apf3_completo"
DATASET = APF3 / "data" / "dataset_modelo.csv"
RESUMEN = APF3 / "outputs" / "resumen.json"
METRICAS = APF3 / "outputs" / "tabla_metricas.csv"
PREDICCIONES = APF3 / "outputs" / "predicciones_test.csv"
OUT = BASE / "src" / "lib" / "simulation" / "apf3" / "model.json"

FEATURES = [
    "temp_ene_abr",
    "temp_may_jul",
    "temp_ago_dic_prev",
    "precip_ene_abr",
    "precip_may_jul",
    "temp_x_precip",
    "rend_media_previa",
    "hectareas",
]
TARGET = "rend_t_ha"
ALPHA = 3.0


def load_rows():
    with DATASET.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def matrix(rows):
    x = np.array([[float(row[name]) for name in FEATURES] for row in rows])
    y = np.array([float(row[TARGET]) for row in rows])
    return x, y


def fit_ridge(x, y):
    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    y_mean = float(y.mean())
    x_scaled = (x - mean) / scale
    y_centered = y - y_mean
    coefficients = np.linalg.solve(x_scaled.T @ x_scaled + ALPHA * np.eye(x.shape[1]), x_scaled.T @ y_centered)
    return coefficients, y_mean, mean, scale


def predict(x, coefficients, intercept, mean, scale):
    return intercept + ((x - mean) / scale) @ coefficients


def main():
    rows = load_rows()
    x, y = matrix(rows)
    coefficients, intercept, mean, scale = fit_ridge(x, y)

    train = [row for row in rows if int(row["campana"]) < 2022]
    test = [row for row in rows if int(row["campana"]) >= 2022]
    x_train, y_train = matrix(train)
    x_test, _ = matrix(test)
    train_coefficients, train_intercept, train_mean, train_scale = fit_ridge(x_train, y_train)
    train_predictions = predict(x_test, train_coefficients, train_intercept, train_mean, train_scale)

    with PREDICCIONES.open(newline="", encoding="utf-8") as handle:
        reference = np.array([float(row["pred_central"]) for row in csv.DictReader(handle)])
    max_parity_error = float(np.max(np.abs(train_predictions - reference)))

    summary = json.loads(RESUMEN.read_text(encoding="utf-8"))
    with METRICAS.open(newline="", encoding="utf-8") as handle:
        metrics_rows = list(csv.DictReader(handle))
    ridge_metrics = next(row for row in metrics_rows if row["modelo"] == "Ridge")

    payload = {
        "version": "agropredic-apf3-ridge-v1.0",
        "algorithm": "StandardScaler + Ridge(alpha=3.0)",
        "target": TARGET,
        "features": FEATURES,
        "means": [float(value) for value in mean],
        "scales": [float(value) for value in scale],
        "coefficients": [float(value) for value in coefficients],
        "intercept": float(intercept),
        "residuals": {
            "q10": float(summary["q10"]),
            "q90": float(summary["q90"]),
        },
        "metrics": {
            "maeValidation": float(ridge_metrics["MAE_val"]),
            "rmseValidation": float(ridge_metrics["RMSE_val"]),
            "mapeValidation": float(ridge_metrics["MAPE_%_val"]),
            "r2Validation": float(ridge_metrics["R2_val"]),
            "maeTest": float(ridge_metrics["MAE_test"]),
            "rmseTest": float(ridge_metrics["RMSE_test"]),
            "mapeTest": float(ridge_metrics["MAPE_%_test"]),
            "r2Test": float(ridge_metrics["R2_test"]),
            "coveragePct": float(summary["cobertura_pct"]),
        },
        "training": {
            "records": int(summary["calidad"]["registros"]),
            "farms": int(summary["calidad"]["fundos"]),
            "campaigns": summary["calidad"]["campanas"],
            "missing": int(summary["calidad"]["faltantes"]),
            "duplicates": int(summary["calidad"]["duplicados"]),
            "meanYield": float(summary["calidad"]["rend_media"]),
            "stdYield": float(summary["calidad"]["rend_std"]),
            "source": "synthetic",
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Modelo exportado a {OUT}")
    print(f"Paridad del refit de entrenamiento con predicciones_test.csv: error máximo = {max_parity_error:.6f}")
    print("El modelo exportado se reentrena con los 139 registros, igual que el .joblib original.")


if __name__ == "__main__":
    main()
