# AgroPredic · pipeline de datos del APF3 (secciones 1 a 3)

Datos **sintéticos** (uva de mesa, Valle de Ica). No describen el desempeño sobre datos reales.
Ejecutar: `./ejecutar_pipeline.sh` (semilla 42; resultados reproducibles).

| Carpeta | Contenido |
| --- | --- |
| `ml/` | Generación de datos, ETL, variables sin fuga, validación del ETL y EDA |
| `tests/` | 5 pruebas automáticas (incluye prueba anti-fuga de datos) |
| `data/raw/` | CSV crudos con fallas inyectadas (`_verdad_terreno_*` solo sirve para probar el ETL) |
| `data/processed/` | `clima_ica_mensual.csv`, `rendimiento_fundos.csv`, `dataset_modelado.csv` |
| `figures/`, `reports/` | Figuras y estadísticas usadas en el informe |

Sugerencia: copiar esta carpeta al repositorio como `ml/` y hacer commit antes de la entrega.
