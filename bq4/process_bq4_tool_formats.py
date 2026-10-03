from datetime import datetime, timedelta
import pandas as pd
from seed_data_generator import generate_completed_sessions

# script de computacion batch (capa 4): calcula la frecuencia de completitud de cada formato
def process_bq4_tool_formats(output_csv="bq4_tool_formats_aggregated.csv"):
    # 1. obtener sesiones (en batch)
    df = generate_completed_sessions(num_records=200)
    
    # 2. solo sesiones terminadas con exito (complete == True)
    completed = df[df["complete"] == True]

    # 3. agrupar y contar por formato de herramienta
    aggregated = completed.groupby("tool_format").agg(
        total_completions=("tool_id", "count")
    ).reset_index()

    # 4. calcular porcentaje de preferencia
    total = aggregated["total_completions"].sum()
    aggregated["completion_percentage"] = ((aggregated["total_completions"] / total) * 100).round(2)

    # 5. fechas de ejecucion batch para el dashboard
    now = datetime.now()
    next_batch = now + timedelta(days=1)
    aggregated["last_updated"] = now.strftime("%Y-%m-%d %H:%M:%S")
    aggregated["next_update"] = next_batch.strftime("%Y-%m-%d 00:00:00")

    # 6. ordenar de mayor a menor completitud
    aggregated = aggregated.sort_values(by="total_completions", ascending=False)

    # 7. guardar el archivo consolidado listo para looker studio
    aggregated.to_csv(output_csv, index=False)
    print(f"[OK] consolidado bq4 actualizado en: {output_csv}")
    print("\n" + aggregated.to_string(index=False))
    return aggregated

if __name__ == "__main__":
    process_bq4_tool_formats()
