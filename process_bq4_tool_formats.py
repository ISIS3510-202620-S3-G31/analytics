import pandas as pd
import os

# script de computacion (capa 4 del pipeline): procesa las interacciones y calcula la metrica de la bq 4
def process_bq4_analytics(input_csv="bq4_tool_interactions_seed.csv", output_summary_csv="bq4_tool_formats_aggregated.csv"):
    if not os.path.exists(input_csv):
        print(f"[ERROR] no se encontro el archivo: {input_csv}")
        return None

    df = pd.read_csv(input_csv)
    
    # 1. solo contar sesiones donde el usuario termino (complete == True)
    completed = df[df["complete"] == True]

    # 2. agrupar por formato de herramienta (touch, voice, text, multimedia)
    aggregated = completed.groupby("tool_format").agg(
        total_completions=("interaction_id", "count"),
        unique_users=("user_id", "nunique"),
        avg_duration_seconds=("duration_seconds", "mean")
    ).reset_index()

    # 3. calcular porcentaje de participacion
    total = aggregated["total_completions"].sum()
    aggregated["completion_percentage"] = ((aggregated["total_completions"] / total) * 100).round(2)
    aggregated["avg_duration_seconds"] = aggregated["avg_duration_seconds"].round(1)

    # 4. ordenar de mayor a menor completitud
    aggregated = aggregated.sort_values(by="total_completions", ascending=False)

    # 5. guardar archivo procesado listo para el dashboard de looker studio
    aggregated.to_csv(output_summary_csv, index=False)
    print(f"[OK] resumen bq4 guardado en: {output_summary_csv}")
    print("\n" + aggregated.to_string(index=False))
    return aggregated

if __name__ == "__main__":
    process_bq4_analytics()
