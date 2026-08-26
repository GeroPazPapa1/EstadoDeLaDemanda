from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "estado_demanda.json"
HOJA_DATOS = "Personas"

CORREDOR_NORTE = {"1A", "2", "13", "14"}
CORREDOR_CENTRO = {"12", "15", "3", "5", "6"}

# El campo "grupo_manual" del origen a veces trae acentos mal
# codificados (ej. "Espont�neas"), por eso se matchea por
# palabra clave sobre el texto normalizado (sin tildes/mayúsculas)
# en lugar de comparar el string exacto.
CANALES = [
    ("108", "108"),
    ("COLABORATIVA", "Colaborativa / 911"),
    ("ESPONT", "Espontáneas"),
    ("PARTICULARES", "Particulares"),
]


def normalizar_ascii(valor: object) -> str:
    texto = "" if pd.isna(valor) else str(valor)

    sin_tildes = unicodedata.normalize("NFKD", texto)
    sin_tildes = "".join(
        caracter
        for caracter in sin_tildes
        if not unicodedata.combining(caracter)
    )

    return sin_tildes.upper().strip()


def etiqueta_canal(valor: object) -> str:
    texto_norm = normalizar_ascii(valor)

    for palabra_clave, etiqueta in CANALES:
        if palabra_clave in texto_norm:
            return etiqueta

    return "Sin especificar"

MESES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


PATRONES_EXCEL = ("estado de la demanda*.xlsx", "personas_*.xlsx")


def encontrar_excel_mas_reciente() -> Path:
    candidatos = [
        ruta
        for patron in PATRONES_EXCEL
        for ruta in BASE_DIR.glob(patron)
    ]

    candidatos.sort(key=lambda ruta: ruta.stat().st_mtime, reverse=True)

    if not candidatos:
        raise FileNotFoundError(
            "No se encontró ningún archivo Excel de origen "
            f"({' / '.join(PATRONES_EXCEL)}) en la carpeta del proyecto."
        )

    return candidatos[0]


def normalizar_nivel_contacto(valor: object) -> str:
    texto = "" if pd.isna(valor) else str(valor).strip()

    if texto in {"Sin cubrir", "Sin dato"}:
        return "sin_cubrir"

    if texto == "Se contacta":
        return "se_contacta"

    if texto == "No se contacta":
        return "no_se_contacta"

    if texto == "Desestimado":
        return "desestimado"

    return "sin_cubrir"


def resumen_vacio() -> dict[str, int]:
    return {
        "se_contacta": 0,
        "no_se_contacta": 0,
        "sin_cubrir": 0,
        "desestimado": 0,
    }


def acumular(resumen: dict[str, int], df: pd.DataFrame) -> dict[str, int]:
    conteo = df["nivel_norm"].value_counts()

    for clave in resumen:
        resumen[clave] = int(conteo.get(clave, 0))

    resumen["total"] = int(len(df))

    return resumen


def construir_bloque_zona(
    df_zona: pd.DataFrame,
    id_zona: str,
    nombre: str,
    estilo: str,
) -> dict[str, object]:
    resumen = acumular(resumen_vacio(), df_zona)

    canales: dict[str, object] = {}

    for _, etiqueta in CANALES:
        if etiqueta in canales:
            continue

        df_canal = df_zona[df_zona["canal"] == etiqueta]
        canales[etiqueta] = acumular(resumen_vacio(), df_canal)

    return {
        "id": id_zona,
        "nombre": nombre,
        "estilo": estilo,
        "resumen": resumen,
        "canales": canales,
    }


def formatear_rango(fecha_desde: pd.Timestamp, fecha_hasta: pd.Timestamp) -> str:
    if fecha_desde.month == fecha_hasta.month:
        return (
            f"Semana del {fecha_desde.day:02d} al {fecha_hasta.day:02d} "
            f"de {MESES[fecha_hasta.month]} de {fecha_hasta.year}"
        )

    return (
        f"Semana del {fecha_desde.day:02d} de {MESES[fecha_desde.month]} "
        f"al {fecha_hasta.day:02d} de {MESES[fecha_hasta.month]} "
        f"de {fecha_hasta.year}"
    )


def main() -> None:
    excel_path = encontrar_excel_mas_reciente()

    print(f"Leyendo: {excel_path.name}")

    df = pd.read_excel(excel_path, sheet_name=HOJA_DATOS)

    df["fecha_inicio"] = pd.to_datetime(df["fecha_inicio"], errors="coerce")
    df["nivel_norm"] = df["nivel_contacto"].map(normalizar_nivel_contacto)
    df["comuna_calculada"] = df["comuna_calculada"].astype(str).str.strip()
    df["canal"] = df["grupo_manual"].map(etiqueta_canal)

    fecha_desde = df["fecha_inicio"].min()
    fecha_hasta = df["fecha_inicio"].max()

    es_norte = df["comuna_calculada"].isin(CORREDOR_NORTE)
    es_centro = df["comuna_calculada"].isin(CORREDOR_CENTRO)
    es_resto = ~es_norte & ~es_centro

    salida = {
        "semana_label": formatear_rango(fecha_desde, fecha_hasta),
        "fecha_desde": fecha_desde.strftime("%Y-%m-%d"),
        "fecha_hasta": fecha_hasta.strftime("%Y-%m-%d"),
        "archivo_origen": excel_path.name,
        "total": acumular(resumen_vacio(), df),
        "zonas": [
            construir_bloque_zona(
                df[es_norte],
                "corredor_norte",
                "Corredor Norte · C1A, C2, C13, C14",
                "navy",
            ),
            construir_bloque_zona(
                df[es_centro],
                "corredor_centro",
                "Corredor Centro · C12, C15, C3, C5, C6",
                "navy",
            ),
            construir_bloque_zona(
                df,
                "total_ciudad",
                "Total de la ciudad",
                "teal",
            ),
            construir_bloque_zona(
                df[es_resto],
                "resto",
                "Resto de ciudad (Comunas 1, 4, 7, 8, 9, 10, 11)",
                "teal",
            ),
        ],
    }

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    with JSON_PATH.open("w", encoding="utf-8") as archivo_json:
        json.dump(salida, archivo_json, ensure_ascii=False, indent=2)

    print()
    print("Conversión finalizada.")
    print(f"Semana: {salida['semana_label']}")
    print(f"Demanda total: {salida['total']['total']}")
    print(f"Archivo generado: {JSON_PATH}")


if __name__ == "__main__":
    main()
