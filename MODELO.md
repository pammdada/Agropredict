# Modelo APF3 de AgroPredic

## 1. Qué predice

APF3 predice el **rendimiento exportable de uva de mesa en el Valle de Ica**, en toneladas por hectárea (`t/ha`), con unos 6 a 8 meses de anticipación respecto de la cosecha principal.

El modelo se usa en el prototipo para simulaciones de tipo `YIELD` cuando el cultivo es `uva` y la zona es `ica`. Para cadena de frío, otros cultivos u otras zonas, el prototipo mantiene el motor demo v0.

> Todos los datos del modelo son **sintéticos**. Las métricas miden qué tan bien el modelo recupera relaciones programadas en el generador; no demuestran precisión con datos reales.

## 2. Datos de entrenamiento

| Elemento | Valor |
| --- | --- |
| Registros | 139 |
| Fundos | 6 |
| Campañas | 2001–2026 |
| Variables del dataset | 14 |
| Faltantes | 0 |
| Duplicados | 0 |
| Rendimiento medio | 15.43 t/ha |
| Desviación estándar | 1.68 t/ha |

Los datos provienen de `agropredic_apf3_completo/agropredic_apf3.py`, que genera:

- `data/clima_mensual_ica_sintetico.csv`: anomalía térmica y precipitación mensual.
- `data/rendimiento_fundos_sintetico.csv`: rendimiento por fundo y campaña.
- `data/dataset_modelo.csv`: features listas para entrenamiento.

La campaña `c` se define de agosto de `c-1` a julio de `c`. El pronóstico usa solo clima disponible hasta julio de `c-1`, evitando fuga de datos. El historial del fundo usa campañas anteriores, nunca la campaña que se predice.

## 3. Variables del modelo

El modelo usa 8 predictores:

| Variable | Significado |
| --- | --- |
| `temp_ene_abr` | Anomalía térmica media de enero a abril del año anterior. |
| `temp_may_jul` | Anomalía térmica media de mayo a julio del año anterior. |
| `temp_ago_dic_prev` | Anomalía térmica media de agosto a diciembre de dos años atrás. |
| `precip_ene_abr` | Precipitación media de enero a abril del año anterior. |
| `precip_may_jul` | Precipitación media de mayo a julio del año anterior. |
| `temp_x_precip` | Interacción entre `temp_ene_abr` y `precip_ene_abr`. |
| `rend_media_previa` | Media histórica de rendimiento del fundo antes de la campaña. |
| `hectareas` | Superficie del fundo. |

La variable objetivo es `rend_t_ha` (`rendimiento exportable en t/ha`).

## 4. Traducción desde el prototipo

El prototipo no captura clima mensual, así que APF3 traduce el escenario climático a las features del modelo. Sea `A` la anomalía del escenario:

- `neutral` → `0`
- `nino_moderate` → `1.3`
- `nino_strong` → `2.6`
- `custom` → valor del usuario, limitado a `[-3, 3]`

La traducción usada es:

| Feature | Fórmula |
| --- | --- |
| `temp_ene_abr` | `0.7 * A` |
| `temp_may_jul` | `0.2 * A` |
| `temp_ago_dic_prev` | `0.1 * A` |
| `precip_ene_abr` | `max(0, 2.229478 + 1.5 * A)` |
| `precip_may_jul` | `max(0, 0.857122 + 0.15 * A)` |
| `temp_x_precip` | `temp_ene_abr * precip_ene_abr` |
| `rend_media_previa` | `crop.baseYieldTHa` |
| `hectareas` | `farm.hectares` |

`rend_media_previa` se aproxima con el rendimiento base del cultivo porque el prototipo todavía no guarda el historial real de rendimiento por fundo. Cuando exista ese dato, debe reemplazar a `crop.baseYieldTHa`.

## 5. Ecuación del modelo

El modelo es una regresión Ridge con estandarización previa:

```text
z_i = (x_i - media_i) / escala_i
ŷ = intercepto + Σ(coeficiente_i * z_i)
```

Parámetros principales:

| Variable | Media | Escala | Coeficiente |
| --- | ---: | ---: | ---: |
| `temp_ene_abr` | 0.3226 | 0.5512 | -0.3144 |
| `temp_may_jul` | 0.1647 | 0.2543 | -0.1650 |
| `temp_ago_dic_prev` | 0.1540 | 0.2477 | -0.0443 |
| `precip_ene_abr` | 2.2295 | 2.1465 | -0.4345 |
| `precip_may_jul` | 0.8571 | 0.4172 | -0.0302 |
| `temp_x_precip` | 1.8580 | 3.5364 | -0.4592 |
| `rend_media_previa` | 15.4727 | 0.9598 | 0.5339 |
| `hectareas` | 69.1007 | 28.5832 | 0.2799 |

Intercepto: `15.425611510791368`.

El `model.json` exportado se reentrena con los 139 registros, igual que el `.joblib` original. Las métricas de la sección 7 provienen del split de validación/prueba, por lo que no son métricas in-sample del artefacto final.

Los parámetros completos están en `src/lib/simulation/apf3/model.json` y se regeneran con `scripts/export_apf3_model.py`.

## 6. Escenarios y rango

A partir de la predicción central `ŷ`:

- **Central:** `ŷ`
- **Optimista:** `ŷ + 1.37`
- **Pesimista:** `ŷ - 0.631`

Los valores `1.37` y `-0.631` son los percentiles 90 y 10 de los residuos de validación del modelo. La cobertura observada del rango en prueba fue **86.7 %**.

La base contra la que se calcula el cambio porcentual es `crop.baseYieldTHa`. Por eso el escenario neutro puede mostrar una pequeña variación respecto de la base: el modelo fue entrenado con un rendimiento medio distinto al rendimiento base del catálogo del prototipo.

## 7. Métricas

| Modelo | MAE validación | MAPE validación | R² validación | MAE prueba | MAPE prueba | R² prueba |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline (media histórica) | 1.477 | 11.052 | 0.028 | 1.359 | 9.558 | 0.226 |
| Regresión lineal | 0.847 | 5.812 | 0.728 | 0.646 | 4.139 | 0.807 |
| **Ridge** | **0.788** | **5.341** | **0.746** | **0.628** | **4.012** | **0.823** |
| Random Forest | 0.929 | 6.890 | 0.600 | 0.538 | 3.616 | 0.882 |

Ridge fue seleccionado por tener el menor MAE de validación. La selección no usa el conjunto de prueba. Aunque Random Forest tiene mejor MAE en prueba, se prefirió el modelo más simple y con mejor validación para reducir el riesgo de sobreajuste.

Criterio APF2: `MAPE <= 15 %` y `cobertura >= 80 %`. APF3 cumple ambos en prueba (`MAPE = 4.012 %`, `cobertura = 86.7 %`).

Otros resultados:

- MAPE en campañas posteriores a Niño: `3.1 %`.
- MAPE en el resto de campañas: `4.7 %`.
- MAE de Random Forest con 10 semillas: `0.551 ± 0.008`.
- MAE con ruido de `0.3 °C` en temperatura: `0.618`.

## 8. Importancia de variables

Importancia por permutación (aumento del MAE al permutar):

| Variable | Importancia |
| --- | ---: |
| `temp_x_precip` | 0.4570 |
| `rend_media_previa` | 0.2811 |
| `precip_ene_abr` | 0.1635 |
| `hectareas` | 0.1340 |
| `temp_ene_abr` | 0.0099 |
| `temp_ago_dic_prev` | -0.0008 |
| `precip_may_jul` | -0.0096 |
| `temp_may_jul` | -0.0112 |

La interacción calor-lluvia y el historial del fundo son los factores con mayor peso.

## 9. Integración en el prototipo

El flujo es:

1. El usuario elige fundo, campaña, escenario climático y horizonte.
2. `src/lib/simulation/service.ts` construye un `SimulationInput`.
3. `src/lib/simulation/engine.ts` enruta:
   - `YIELD` + `uva` + `ica` → `src/lib/simulation/apf3/engine.ts`.
   - `COLD_CHAIN` u otro cultivo/zona → `src/lib/simulation/engine-v0.ts`.
4. El motor APF3 construye las features, aplica la ecuación Ridge y genera escenarios, factores, acciones y serie mensual.
5. El resultado se guarda con `modelVersion = "agropredic-apf3-ridge-v1.0"` y `dataQuality = "apf3_synthetic"`.

No se ejecuta Python en producción. El archivo `.joblib` es el artefacto original de entrenamiento; el prototipo usa su equivalente portado a TypeScript en `model.json`.

### Factores

Los factores descomponen la predicción respecto de la media del dataset de entrenamiento:

- Historial productivo del fundo.
- Estrés térmico en floración y brotación.
- Lluvias e interacción calor-lluvia.
- Escala del fundo.

### Acciones

Las acciones recomendadas se activan según la caída del escenario central frente a la base:

- Caída `<= -15 %`: acciones de prioridad alta.
- Caída `<= -5 %`: acciones de prioridad media/alta.
- Caída mayor a `-5 %`: acción de seguimiento.

## 10. Limitaciones

- Los datos son sintéticos; el modelo no está validado con SENAMHI, MIDAGRI ni datos reales de un fundo.
- `rend_media_previa` usa el rendimiento base del cultivo como aproximación.
- La traducción de escenario climático a clima mensual es una simplificación.
- El modelo fue entrenado para uva de mesa en Ica. No debe usarse en mango, palta, Piura u Olmos.
- El horizonte del modelo es fijo (corte en julio del año anterior). El horizonte de la UI solo afecta la presentación de la serie mensual.
- La cadena de frío sigue siendo un motor demo parametrizado.
- Las decisiones recomendadas son apoyo operativo, no una garantía de resultado.

## 11. Cómo reentrenar y actualizar

Requisitos Python: `numpy`, `pandas`, `scikit-learn`, `joblib` y `matplotlib`.

```bash
python agropredic_apf3_completo/agropredic_apf3.py
python scripts/export_apf3_model.py
npm run typecheck
npm run lint
npm run build
```

El primer comando regenera datos, métricas y el `.joblib`. El segundo lee `dataset_modelo.csv`, vuelve a ajustar `StandardScaler + Ridge(alpha=3.0)` y escribe `src/lib/simulation/apf3/model.json`.

Si se reemplazan los datos sintéticos por datos reales:

1. Reemplazar `generar_datos()` por la lectura de los CSV reales.
2. Mantener el mismo esquema de features o actualizar `features.ts`.
3. Reentrenar y revisar `outputs/tabla_metricas.csv` y `outputs/resumen.json`.
4. Regenerar `model.json` con `scripts/export_apf3_model.py`.
5. Actualizar la versión en `model.json` y en `MODELO.md`.

## 12. Archivos relevantes

| Archivo | Rol |
| --- | --- |
| `agropredic_apf3_completo/agropredic_apf3.py` | Generación de datos, entrenamiento, métricas y exportación del `.joblib`. |
| `agropredic_apf3_completo/data/dataset_modelo.csv` | Dataset de modelado. |
| `agropredic_apf3_completo/models/modelo_agropredic.joblib` | Modelo original serializado. |
| `agropredic_apf3_completo/outputs/tabla_metricas.csv` | Comparación de modelos. |
| `agropredic_apf3_completo/outputs/resumen.json` | Resumen de métricas y cuantiles. |
| `agropredic_apf3_completo/outputs/predicciones_test.csv` | Predicciones de prueba y errores. |
| `scripts/export_apf3_model.py` | Exporta los parámetros a JSON. |
| `src/lib/simulation/apf3/model.json` | Parámetros del modelo usados por el prototipo. |
| `src/lib/simulation/apf3/model.ts` | Tipos y predicción Ridge. |
| `src/lib/simulation/apf3/features.ts` | Traducción de `SimulationInput` a features. |
| `src/lib/simulation/apf3/engine.ts` | Motor APF3 que implementa el contrato. |
| `src/lib/simulation/engine.ts` | Enrutador APF3 / demo v0. |
