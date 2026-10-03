# Ark Mobile - Analytics Pipeline & Business Intelligence (Sprint 2)

Este repositorio contiene la capa de **Computation / Processing** del Analytics Pipeline del proyecto **Ark**, diseñado según la arquitectura de 5 capas de SE4MA (Capítulo 9).

---

## 🏛️ Arquitectura General del Pipeline
1. **Data Sources:** Apps móviles Android (Kotlin) y Flutter (iOS).
2. **Ingestion & Integration:** Firebase Backend (REST API Endpoints).
3. **Storage:** Cloud Firestore (`mood_checkins`, `tool_interactions`, `tool_feedback`).
4. **Computation (Este Repositorio):** Scripts de procesamiento (Node.js / Python) para agregaciones y métricas.
5. **Presentation:** Dashboard interactivo central en **Looker Studio (Data Studio)**.

---

# 📊 BQ 4: Tool Interaction Formats (Laura Martínez - Tipo 3)

**Pregunta de Negocio:** *Which tool interaction format (voice, text, touch, or multimedia) do users complete most frequently, measured by the total count of completed tool sessions?*

### Flujo de Datos
`Firestore (tool_interactions) → Python Script → CSV / Google Sheets → Looker Studio`

### Comandos y Ejecución (Python)
1. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
2. Generar datos seed de interacciones:
   ```bash
   python seed_data_generator.py
   ```
3. Procesar métricas agregadas por formato:
   ```bash
   python process_bq4_tool_formats.py
   ```

### Construcción del Reporte en Looker Studio para BQ 4
1. Abre `bq4_tool_interactions_seed.csv` o `bq4_tool_formats_aggregated.csv` en Google Sheets (o súbelo directo a Looker Studio).
2. Agrega un **Gráfico de Barras**: Dimensión = `tool_format`, Métrica = `total_completions`.
3. Agrega un **Gráfico de Anillo**: Dimensión = `tool_format`, Métrica = `completion_percentage`.
4. Agrega una **Tarjeta de Resultado (Scorecard)** con el total de sesiones completadas.

---

# 📈 Emotion entries by week and age

Answers: *What are the peak weeks for emotion entries across the calendar, segmented by age?*

Firestore → `export.js` → CSV → Google Sheets → Looker Studio.

The data comes from the Flutter app (`frontend-flutter`), which writes the check-ins and tool feedback this reads.

## Before running

The service account key is a secret and must stay **outside this repository**.
Keep it in one of the folders above this one, or set `SERVICE_ACCOUNT` to its
path. `.gitignore` blocks `*-firebase-adminsdk-*.json` as a second guard.

```bash
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run export` | Writes `out/emotion_entries.csv` and prints the peak week per age group |
| `npm run seed` | Adds 25 demo users with 10 weeks of entries, all marked `demo: true` |
| `npm run clean` | Deletes everything that `seed` created |

## Building the report

1. Open `out/emotion_entries.csv` in Google Sheets (File → Import → Upload, "Replace current sheet").
2. In Looker Studio: Create → Report → Google Sheets → pick that sheet.
3. Add a **stacked column chart**: dimension `week`, breakdown `age_bucket`, metric `Record Count`, sorted by `week` ascending.
4. Add a **table**: dimensions `age_bucket` and `week`, metric `Record Count`, sorted descending.
