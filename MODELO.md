# Modelo APF3 de AgroPredic

## 1. Qué predice

APF3 predice el **rendimiento exportable de uva de mesa en el Valle de Ica**, en toneladas por hectárea (`t/ha`), con unos 6 a 8 meses de anticipación respecto de la cosecha principal.

El modelo se usa en el prototipo para simulaciones de tipo `YIELD` cuando el cultivo es `uva` y la zona es `ica`. Para cadena de frío, otros cultivos u otras zonas, el prototipo mantiene el motor demo v0.

> Todos los datos del modelo son **sintéticos**. Las métricas miden qué tan bien el modelo recupera relaciones programadas en el generador; no demuestran precisión con datos reales.

## 2. Datos de entrenamiento

| Elemento | Valor |
| --- | --- |
| Registros | 162 |
| Fundos | 10 |
| Campañas | 2001–2025 |
| Faltantes | 0 |
| Duplicados | 0 |
| Rendimiento medio | 19.68 t/ha |
| Desviación estándar | 2.31 t/ha |

Los datos provienen de `agropredic_ml_APF3/`:

- `ml/01_generar_dataset.py`: genera los CSV crudos con fallas inyectadas (semilla 42).
- `ml/02_etl_limpieza_features.py`: limpieza, imputación con bandera y construcción de variables sin fuga.
- `data/processed/clima_ica_mensual.csv`: clima mensual procesado.
- `data/processed/rendimiento_fundos.csv`: rendimiento por fundo y campaña.
- `data/processed/dataset_modelado.csv`: dataset final de modelado.

La campaña `c` se define de agosto de `c-1` a julio de `c`. El pronóstico se hace al **30 de junio** del año de inicio. Las variables del Conjunto A usan solo información disponible hasta esa fecha; las del Conjunto B son futuro y entran como escenario climático.

## 3. Variables del modelo

El modelo usa 12 predictores (Conjunto A + Conjunto B):

| Variable | Conjunto | Significado |
| --- | --- | --- |
| `oni_djf_previo` | A | ONI DJF del año de inicio, observado al 30-jun. |
| `anom_tmax_ene_mar` | A | Anomalía de temperatura máxima de enero a marzo del año de inicio. |
| `anom_tmean_abr_jun` | A | Anomalía de temperatura media de abril a junio del año de inicio. |
| `precip_ene_mar_prev` | A | Precipitación acumulada de enero a marzo del año de inicio. |
| `rend_prev` | Historial | Rendimiento del fundo en la campaña anterior. |
| `rend_media_hist` | Historial | Media histórica del fundo antes de la campaña. |
| `n_campanas_previas` | Historial | Número de campañas registradas antes de la campaña. |
| `hectareas` | Escala | Superficie del fundo. |
| `oni_djf_cosecha` | B | ONI DJF de la campaña de cosecha (escenario). |
| `anom_tmean_set_nov` | B | Anomalía de temperatura media de septiembre a noviembre (escenario). |
| `hr_set_nov` | B | Humedad relativa media de septiembre a noviembre (escenario). |
| `precip_ene_mar_cosecha` | B | Precipitación acumulada de enero a marzo de la cosecha (escenario). |

La variable objetivo es `rend_t_ha` (`rendimiento exportable en t/ha`).

## 4. Traducción desde el prototipo

El prototipo no captura clima mensual, así que APF3 traduce el escenario climático a las features del modelo. Sea `A` la anomalía del escenario:

- `neutral` → `0`
- `nino_moderate` → `1.3`
- `nino_strong` → `2.6`
- `custom` → valor del usuario, limitado a `[-3, 3]`

Las variables climáticas se construyen con la relación lineal estimada del dataset:

```text
feature = intercepto + pendiente * A
ONI previo = ONI cosecha = A
```

| Feature | Intercepto | Pendiente |
| --- | ---: | ---: |
| `anom_tmax_ene_mar` | 0.180850 | 0.860181 |
| `anom_tmean_abr_jun` | 0.173057 | 0.543151 |
| `precip_ene_mar_prev` | 3.445229 | -0.164859 |
| `anom_tmean_set_nov` | 0.139298 | 0.422855 |
| `hr_set_nov` | 69.795561 | 1.201045 |
| `precip_ene_mar_cosecha` | 3.297346 | -0.180002 |

Las precipitaciones se limitan a `>= 0`. Los coeficientes se calculan desde `dataset_modelado.csv` y se guardan en `model.json` (`scenario.climates`); no están hardcodeados en TypeScript.

Las variables no climáticas se aproximan desde el prototipo:

| Feature | Valor en el prototipo |
| --- | --- |
| `rend_prev` | `crop.baseYieldTHa` |
| `rend_media_hist` | `crop.baseYieldTHa` |
| `n_campanas_previas` | `farm.historyYears` |
| `hectareas` | `farm.hectares` |

`rend_prev` y `rend_media_hist` usan el rendimiento base del cultivo porque el prototipo todavía no guarda el historial real por fundo. Cuando exista ese dato, debe reemplazar a `crop.baseYieldTHa`.

## 5. Ecuación del modelo

El modelo es una regresión Ridge con estandarización previa:

```text
z_i = (x_i - media_i) / escala_i
ŷ = intercepto + Σ(coeficiente_i * z_i)
```

Parámetros principales:

| Variable | Media | Escala | Coeficiente |
| --- | ---: | ---: | ---: |
| `oni_djf_previo` | -0.0926 | 1.0441 | -0.4848 |
| `anom_tmax_ene_mar` | 0.1012 | 1.0780 | -0.0467 |
| `anom_tmean_abr_jun` | 0.1228 | 0.6754 | -0.2943 |
| `precip_ene_mar_prev` | 3.4605 | 11.1694 | -0.0863 |
| `rend_prev` | 19.5783 | 2.3292 | 0.3536 |
| `rend_media_hist` | 19.1190 | 1.3086 | 0.6229 |
| `n_campanas_previas` | 9.9506 | 6.3865 | 0.4207 |
| `hectareas` | 123.6420 | 76.7025 | -0.0795 |
| `oni_djf_cosecha` | -0.0525 | 1.0478 | -0.4233 |
| `anom_tmean_set_nov` | 0.1171 | 0.6337 | -0.2667 |
| `hr_set_nov` | 69.7325 | 2.7901 | 0.2370 |
| `precip_ene_mar_cosecha` | 3.3068 | 10.4792 | -0.5186 |

Intercepto: `19.680246913580245`.

El `model.json` exportado se reentrena con los 162 registros. Las métricas de la sección 7 provienen de validación y prueba, por lo que no son métricas in-sample del artefacto final.

Los parámetros completos están en `src/lib/simulation/apf3/model.json` y se regeneran con `scripts/export_apf3_model.py`.

## 6. Escenarios y rango

A partir de la predicción central `ŷ`:

- **Central:** `ŷ`
- **Optimista:** `ŷ + 2.0718`
- **Pesimista:** `ŷ - 1.9744`

Los valores `2.0718` y `-1.9744` son los percentiles 90 y 10 de los residuos out-of-fold de la validación leave-one-farm-out. La cobertura observada del rango fue **79.0 %**.

La base contra la que se calcula el cambio porcentual es `crop.baseYieldTHa` (19.5 t/ha en el catálogo). El rendimiento medio del dataset es 19.68 t/ha, por lo que el escenario neutro puede mostrar una variación pequeña respecto de la base.

## 7. Métricas

| Evaluación | MAE | RMSE | MAPE | R² |
| --- | ---: | ---: | ---: | ---: |
| Validación leave-one-farm-out | 1.289 | 1.585 | 6.69 % | 0.527 |
| Prueba temporal (campañas ≥ 2021) | 1.502 | 1.765 | 7.78 % | 0.431 |

La validación deja fuera un fundo completo por vez, para medir generalización a fundos no vistos. La prueba entrena con campañas anteriores a 2021 y evalúa con 2021–2025.

Criterio APF2: `MAPE <= 15 %` y `cobertura >= 80 %`. APF3 cumple el MAPE en prueba (`7.78 %`); la cobertura es **79.0 %**, ligeramente por debajo del umbral de 80 %.

## 8. Peso de las variables

Coeficientes estandarizados (mayor magnitud, mayor peso sobre la predicción):

| Variable | Coeficiente estandarizado |
| --- | ---: |
| `rend_media_hist` | 0.6229 |
| `precip_ene_mar_cosecha` | -0.5186 |
| `oni_djf_previo` | -0.4848 |
| `oni_djf_cosecha` | -0.4233 |
| `n_campanas_previas` | 0.4207 |
| `rend_prev` | 0.3536 |
| `anom_tmean_abr_jun` | -0.2943 |
| `anom_tmean_set_nov` | -0.2667 |
| `hr_set_nov` | 0.2370 |
| `precip_ene_mar_prev` | -0.0863 |
| `hectareas` | -0.0795 |
| `anom_tmax_ene_mar` | -0.0467 |

El historial del fundo, el ONI y las lluvias de cosecha son los factores con mayor peso.

## 9. Integración en el prototipo

El flujo es:

1. El usuario elige fundo, campaña, escenario climático y horizonte.
2. `src/lib/simulation/service.ts` construye un `SimulationInput`.
3. `src/lib/simulation/engine.ts` enruta:
   - `YIELD` + `uva` + `ica` → `src/lib/simulation/apf3/engine.ts`.
   - `COLD_CHAIN` u otro cultivo/zona → `src/lib/simulation/engine-v0.ts`.
4. El motor APF3 construye las features, aplica la ecuación Ridge y genera escenarios, factores, acciones y serie mensual.
5. El resultado se guarda con `modelVersion = "agropredic-apf3-ridge-v2.0"` y `dataQuality = "apf3_synthetic"`.

No se ejecuta Python en producción. El prototipo usa el equivalente portado a TypeScript en `model.json`.

### Factores

Los factores descomponen la predicción respecto de la media del dataset de entrenamiento:

- Historial productivo del fundo.
- Estrés térmico y señal ENSO.
- Lluvias y humedad en floración.
- Escala del fundo.

### Acciones

Las acciones recomendadas se activan según la caída del escenario central frente a la base:

- Caída `<= -15 %`: acciones de prioridad alta.
- Caída `<= -5 %`: acciones de prioridad media/alta.
- Caída mayor a `-5 %`: acción de seguimiento.

## 10. Limitaciones

- Los datos son sintéticos; el modelo no está validado con SENAMHI, MIDAGRI ni datos reales de un fundo.
- `rend_prev` y `rend_media_hist` usan el rendimiento base del cultivo como aproximación.
- La traducción de escenario climático a clima mensual es una simplificación lineal estimada del dataset.
- El modelo fue entrenado para uva de mesa en Ica. No debe usarse en mango, palta, Piura u Olmos.
- El horizonte del modelo es fijo (corte al 30-jun del año de inicio). El horizonte de la UI solo afecta la presentación de la serie mensual.
- La cadena de frío sigue siendo un motor demo parametrizado.
- Las decisiones recomendadas son apoyo operativo, no una garantía de resultado.

## 11. Cómo reentrenar y actualizar

Requisitos Python: `numpy`, `pandas`, `scipy`, `matplotlib` y `scikit-learn`.

```bash
cd agropredic_ml_APF3
./ejecutar_pipeline.sh
cd ..
python scripts/export_apf3_model.py
npm run typecheck
npm run lint
npm run build
```

`ejecutar_pipeline.sh` regenera datos, ETL, reportes y pruebas con semilla 42. `scripts/export_apf3_model.py` lee `agropredic_ml_APF3/data/processed/dataset_modelado.csv`, ajusta `StandardScaler + Ridge(alpha=10.0)`, calcula métricas leave-one-farm-out y split temporal, estima el mapeo de escenario y escribe `src/lib/simulation/apf3/model.json`.

Si se reemplazan los datos sintéticos por datos reales:

1. Reemplazar la generación de `ml/01_generar_dataset.py` por la lectura de los CSV reales.
2. Mantener el esquema de features o actualizar `model.ts` y `features.ts`.
3. Revisar `reports/calidad_datos.json` y `reports/validacion_etl.json`.
4. Regenerar `model.json` con `scripts/export_apf3_model.py`.
5. Actualizar la versión en `model.json` y en `MODELO.md`.

## 12. Archivos relevantes

| Archivo | Rol |
| --- | --- |
| `agropredic_ml_APF3/ml/01_generar_dataset.py` | Generación de datos sintéticos crudos con fallas inyectadas. |
| `agropredic_ml_APF3/ml/02_etl_limpieza_features.py` | Limpieza, imputación y construcción del dataset de modelado. |
| `agropredic_ml_APF3/ml/features.py` | Definición de Conjunto A / Conjunto B y reglas anti-fuga. |
| `agropredic_ml_APF3/data/processed/dataset_modelado.csv` | Dataset de modelado. |
| `agropredic_ml_APF3/tests/test_pipeline.py` | Pruebas del pipeline, incluida la anti-fuga. |
| `scripts/export_apf3_model.py` | Entrena, evalúa y exporta los parámetros a JSON. |
| `src/lib/simulation/apf3/model.json` | Parámetros del modelo usados por el prototipo. |
| `src/lib/simulation/apf3/model.ts` | Tipos y predicción Ridge. |
| `src/lib/simulation/apf3/features.ts` | Traducción de `SimulationInput` a features. |
| `src/lib/simulation/apf3/engine.ts` | Motor APF3 que implementa el contrato. |
| `src/lib/simulation/engine.ts` | Enrutador APF3 / demo v0. |
