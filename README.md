# Ark Analytics Pipeline

Repositorio de computacion y procesamiento del pipeline de analitica para el proyecto Ark (Sprint 2), estructurado segun la arquitectura de 5 capas de SE4MA (Capitulo 9).

---

## BQ 4: Tool Interaction Formats (Laura Martinez - Tipo 3)

Pregunta de negocio: Which tool interaction format (voice, text, touch, or multimedia) do users complete most frequently, measured by the total count of completed tool sessions?

Ubicacion de archivos: carpeta `bq4/`

### Generacion de Datos Sinteticos (Seed)
Los datos cargados para la simulacion del pipeline y construccion de los dashboards son **100% sinteticos y generados programmaticamente** (`seed_firestore_bq4.py`), representando 25 usuarios ficticios con correos `@gmail.com` y 200 interacciones realistas distribuidas segun las 12 herramientas del diagrama UML de Ark (`Format: TOUCH, VOICE, TEXT, MULTIMEDIA`).
- Para poblar o resetear los datos generados:
  ```bash
  python seed_firestore_bq4.py
  ```

### Flujo de datos
Firestore (tool_interactions) -> Python Script (Batch) -> CSV / Google Sheets -> Looker Studio.

### Ejecucion del script
1. Instalar dependencias:
   ```bash
   cd bq4
   pip install -r requirements.txt
   ```
2. Ejecutar procesamiento batch:
   ```bash
   python process_bq4_tool_formats.py
   ```
   Genera el archivo consolidado `bq4_tool_formats_aggregated.csv` con columnas `tool_format`, `total_completions`, `completion_percentage`, `last_updated`, `next_update`.

### Automatizacion Batch
El pipeline se ejecuta de forma automatica en batch todas las noches mediante GitHub Actions (`.github/workflows/bq4_batch_pipeline.yml`).

### Construccion del reporte en Looker Studio
1. Abrir `bq4/bq4_tool_formats_aggregated.csv` en Google Sheets (o el enlace de Google Drive compartido).
2. En Looker Studio, conectar la hoja mediante el conector Hojas de calculo de Google.
3. Agregar grafico de barras con dimension `tool_format` y metrica `total_completions`.
4. Agregar grafico circular con dimension `tool_format` y metrica `completion_percentage`.
5. Agregar tarjetas con `last_updated` y `next_update`.

---

## Emotion entries by week and age

Pregunta de negocio: What are the peak weeks for emotion entries across the calendar, segmented by age?

### Flujo de datos
Firestore -> export.js -> CSV -> Google Sheets -> Looker Studio.

### Ejecucion de scripts (Node.js)
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Comandos disponibles:
   - `npm run seed`: Crea 25 usuarios demo y 10 semanas de registros en Firestore.
   - `npm run export`: Descarga los datos de Firestore a `out/emotion_entries.csv`.
   - `npm run clean`: Elimina los datos demo de Firestore.

---

## BQ 3: Recommended regulation tool (Yefran - Tipo 2)

Pregunta de negocio: Which regulation tool is the app going to recommend to the user, so it can be surfaced first instead of buried in the toolbox?

Ubicacion de archivos: carpeta `bq3/`

### Flujo de datos
App Flutter (tarjeta "Recommended for you" del Home) -> Firestore (`users/{uid}/recommendations`) -> `bq3/process_recommendations.js` -> CSV -> Google Sheets -> Looker Studio.

Cada vez que el Home muestra una recomendacion, la app guarda `toolId`, `toolName`, `strategy` (Mood based, Frequency based o Default), `reason`, `shownAt` y `opened`. Si el usuario la toca, `opened` pasa a `true`.

### Ejecucion de scripts (Node.js)
- `npm run seed:bq3`: Crea 20 usuarios demo con 4 semanas de recomendaciones en Firestore (`demo: true`).
- `npm run process:bq3`: Descarga las recomendaciones a `out/bq3_recommendations.csv` (una fila por recomendacion) e imprime la herramienta mas recomendada.
- `npm run clean:bq3`: Elimina solo los datos demo de BQ3.

### Construccion del reporte en Looker Studio
1. Importar `out/bq3_recommendations.csv` en Google Sheets.
2. En el reporte compartido, agregar una pagina BQ3 y conectar la hoja con el conector Hojas de calculo de Google.
3. Crear el campo calculado `open_rate` = `SUM(opened) / COUNT(tool_id)` en formato porcentaje.
4. Barras: `tool_name` por Record Count (que herramienta recomienda mas la app).
5. Anillo: `strategy` por Record Count. Barras: `tool_name` por `open_rate`. Serie temporal: `date` por Record Count, desglose `strategy`.
