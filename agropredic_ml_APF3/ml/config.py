"""Configuración común del pipeline de datos de AgroPredic (APF3).

Todos los scripts leen esta configuración para garantizar reproducibilidad.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
FIG = ROOT / "figures"
REP = ROOT / "reports"

SEED = 42                      # semilla única del proyecto
PRIMER_ANIO = 2000             # primer año de la serie climática
ULTIMO_MES = "2026-06"         # último mes disponible (fecha de corte del APF3)
BASE_CLIMA = (2000, 2020)      # periodo base para anomalías (21 años)
FECHA_PRONOSTICO = "30-jun"    # momento en que se emite la proyección


def clase_enso(oni_djf: float) -> str:
    """Clasificación ENSO usada en el MVP (APF2) a partir del ONI de DJF de cosecha."""
    if oni_djf >= 1.0:
        return "Niño moderado/fuerte"
    if oni_djf >= 0.5:
        return "Niño débil"
    return "Neutro/Niña"


ORDEN_ENSO = ["Neutro/Niña", "Niño débil", "Niño moderado/fuerte"]
