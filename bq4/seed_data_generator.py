import random
from datetime import datetime, timedelta
import pandas as pd

# catalogo de las 12 herramientas de ark con sus formatos segun la arquitectura (#34)
TOOLS = [
    {"toolId": "custom_breathing", "name": "Custom Breathing", "format": "touch", "category": "breathing_regulation"},
    {"toolId": "body_mapping", "name": "Body Mapping", "format": "touch", "category": "grounding_mindfulness"},
    {"toolId": "haptic_tapping", "name": "Haptic Tapping", "format": "touch", "category": "grounding_mindfulness"},
    {"toolId": "scream_tank", "name": "Scream Tank", "format": "voice", "category": "somatic_release"},
    {"toolId": "blow_it_out", "name": "Blow It Out", "format": "voice", "category": "somatic_release"},
    {"toolId": "voice_journal", "name": "Voice Journal", "format": "voice", "category": "emotional_awareness"},
    {"toolId": "emotion_detective", "name": "Emotion Detective", "format": "text", "category": "emotional_awareness"},
    {"toolId": "achievement_jar", "name": "Achievement Jar", "format": "text", "category": "behavioral_activation"},
    {"toolId": "gratitude_notes", "name": "Gratitude Notes", "format": "text", "category": "behavioral_activation"},
    {"toolId": "thought_reframing", "name": "Thought Reframing", "format": "text", "category": "emotional_awareness"},
    {"toolId": "photo_of_the_day", "name": "Photo of the Day", "format": "multimedia", "category": "behavioral_activation"},
    {"toolId": "visual_anchoring", "name": "Visual Anchoring", "format": "multimedia", "category": "grounding_mindfulness"},
]

# lista de 25 usuarios ficticios para simular interacciones
USERS = [f"user_{i:03d}" for i in range(1, 26)]

def generate_seed_dataset(num_records=200):
    # genera datos de prueba de sesiones de herramientas para responder la bq 4 (laura martinez - tipo 3)
    records = []
    base_time = datetime.now() - timedelta(days=14)

    # pesos para simular las preferencias reales de los usuarios
    format_weights = {"touch": 0.38, "voice": 0.32, "text": 0.18, "multimedia": 0.12}

    tools_by_format = {}
    for t in TOOLS:
        tools_by_format.setdefault(t["format"], []).append(t)

    for i in range(num_records):
        user_id = random.choice(USERS)
        
        # elegir un formato segun la distribucion de probabilidad
        chosen_format = random.choices(
            list(format_weights.keys()),
            weights=list(format_weights.values()),
            k=1
        )[0]

        tool = random.choice(tools_by_format[chosen_format])
        
        # la mayoria completa el ejercicio satisfactoriamente (88%)
        is_completed = random.random() < 0.88
        
        # duracion estimada en segundos segun el formato
        if chosen_format == "touch":
            duration = random.randint(30, 180)
        elif chosen_format == "voice":
            duration = random.randint(15, 90)
        elif chosen_format == "text":
            duration = random.randint(60, 300)
        else:
            duration = random.randint(20, 120)

        # fecha aleatoria dentro de los ultimos 14 dias
        random_offset = random.randint(0, 14 * 24 * 3600)
        interaction_time = base_time + timedelta(seconds=random_offset)

        records.append({
            "interaction_id": f"inter_{i+1:04d}",
            "user_id": user_id,
            "tool_id": tool["toolId"],
            "tool_name": tool["name"],
            "tool_format": chosen_format,
            "category": tool["category"],
            "duration_seconds": duration,
            "complete": is_completed,
            "timestamp": interaction_time.strftime("%Y-%m-%d %H:%M:%S")
        })

    return pd.DataFrame(records)

if __name__ == "__main__":
    print("[INFO] generando dataset sintetico para bq4...")
    df = generate_seed_dataset(num_records=200)
    
    # guardar en csv para conectar a looker studio
    output_path = "bq4_tool_interactions_seed.csv"
    df.to_csv(output_path, index=False)
    print(f"[OK] archivo creado: {output_path} ({len(df)} registros)")

    # resumen de completitud por formato
    completed_df = df[df["complete"] == True]
    summary = completed_df.groupby("tool_format").agg(
        total_completions=("interaction_id", "count"),
        avg_duration_seconds=("duration_seconds", "mean")
    ).reset_index()
    
    summary["completion_share"] = (summary["total_completions"] / summary["total_completions"].sum()) * 100
    summary = summary.sort_values(by="total_completions", ascending=False)
    
    print("\n--- resumen bq 4 (completitud por formato) ---")
    print(summary.to_string(index=False))
