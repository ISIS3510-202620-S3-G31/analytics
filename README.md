# Ark Analytics Pipeline

Repositorio de computacion y procesamiento del pipeline de analitica para el proyecto Ark (Sprint 2), estructurado segun la arquitectura de 5 capas de SE4MA (Capitulo 9).

---

## BQ 4: Tool Interaction Formats (Laura Martinez - Tipo 3)

Pregunta de negocio: Which tool interaction format (voice, text, touch, or multimedia) do users complete most frequently, measured by the total count of completed tool sessions?

Ubicacion de archivos: carpeta `bq4/`

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
1. Abrir `bq4/bq4_tool_formats_aggregated.csv` en Google Sheets (o subirlo al enlace de Google Drive compartido).
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
