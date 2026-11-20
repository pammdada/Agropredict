#!/usr/bin/env bash
# Reproduce todo el pipeline de datos del APF3 (semilla fija = 42). Ejecutar desde la raíz de ml-agropredic.
set -euo pipefail
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ml
python 01_generar_dataset.py          # datos sintéticos crudos (con fallas inyectadas)
python 02_etl_limpieza_features.py    # limpieza, validación, imputación con flag, variables
python 02b_validar_etl.py             # ETL vs verdad de terreno
python 03_eda.py                      # estadísticas y figuras
cd .. && python tests/test_pipeline.py  # pruebas (incluye prueba anti-fuga de datos)
